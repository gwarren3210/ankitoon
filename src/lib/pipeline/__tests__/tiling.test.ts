import { describe, it, expect, beforeAll } from 'bun:test'
import sharp from 'sharp'
import {
  createAdaptiveTiles,
  adjustCoordinates,
  filterDuplicates,
  needsTiling
} from '@/lib/pipeline/tiling'
import { OcrResult, OcrResultWithContext } from '@/lib/pipeline/types'

describe('tiling', () => {
  let smallImageBuffer: Buffer
  let largeImageBuffer: Buffer

  beforeAll(async () => {
    // Small image: 800x600, ~50KB
    smallImageBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    })
      .jpeg()
      .toBuffer()

    // Large image: 4000x6000, >1MB (use PNG for larger file size)
    largeImageBuffer = await sharp({
      create: {
        width: 4000,
        height: 6000,
        channels: 3,
        background: { r: 128, g: 128, b: 128 }
      }
    })
      .png()
      .toBuffer()
  })

  describe('needsTiling', () => {
    it('returns false for small images', () => {
      const threshold = 1 * 1024 * 1024 // 1MB
      expect(needsTiling(smallImageBuffer, threshold)).toBe(false)
    })

    it('returns true for images over threshold', () => {
      const threshold = 50 * 1024 // 50KB - below our test image size
      expect(needsTiling(largeImageBuffer, threshold)).toBe(true)
    })

    it('uses default threshold when not provided', () => {
      expect(needsTiling(smallImageBuffer)).toBe(false)
    })
  })

  describe('createAdaptiveTiles', () => {
    it('returns single tile for small images', async () => {
      const tiles = await createAdaptiveTiles(smallImageBuffer)
      
      expect(tiles).toHaveLength(1)
      expect(tiles[0].startY).toBe(0)
      expect(tiles[0].width).toBe(800)
      expect(tiles[0].height).toBe(600)
    })

    it('creates multiple tiles when over threshold', async () => {
      const tiles = await createAdaptiveTiles(largeImageBuffer, {
        fileSizeThreshold: 20 * 1024 // 20KB - force tiling
      })
      
      expect(tiles.length).toBeGreaterThan(1)
      expect(tiles[0].startY).toBe(0)
      
      // Check tiles are sequential
      for (let i = 1; i < tiles.length; i++) {
        expect(tiles[i].startY).toBeGreaterThan(tiles[i - 1].startY)
      }
    })

    it('creates tiles with proper dimensions', async () => {
      const tiles = await createAdaptiveTiles(largeImageBuffer, {
        fileSizeThreshold: 20 * 1024
      })
      
      for (const tile of tiles) {
        expect(tile.width).toBe(4000)
        expect(tile.height).toBeGreaterThan(0)
        expect(tile.buffer).toBeInstanceOf(Buffer)
      }
    })

    it('respects custom threshold', async () => {
      // Use large image with a threshold below its size
      const tiles = await createAdaptiveTiles(largeImageBuffer, {
        fileSizeThreshold: 20 * 1024 // 20KB
      })
      
      expect(tiles.length).toBeGreaterThan(1)
    })

    it('covers entire image height', async () => {
      const tiles = await createAdaptiveTiles(largeImageBuffer, {
        fileSizeThreshold: 20 * 1024
      })
      const totalHeight = tiles.reduce((sum, tile) => sum + tile.height, 0)
      
      expect(totalHeight).toBeGreaterThanOrEqual(6000)
    })
  })

  describe('adjustCoordinates', () => {
    it('adjusts Y coordinates by tile startY', () => {
      const results: OcrResult[] = [
        {
          text: 'test',
          bbox: { x: 10, y: 20, width: 50, height: 30 }
        }
      ]
      
      const tile = {
        buffer: Buffer.from(''),
        startY: 100,
        width: 800,
        height: 600
      }
      
      const adjusted = adjustCoordinates(results, tile)
      
      expect(adjusted).toHaveLength(1)
      expect(adjusted[0].bbox.x).toBe(10)
      expect(adjusted[0].bbox.y).toBe(120) // 20 + 100
      expect(adjusted[0].bbox.width).toBe(50)
      expect(adjusted[0].bbox.height).toBe(30)
      expect(adjusted[0].text).toBe('test')
    })

    it('preserves X coordinates', () => {
      const results: OcrResult[] = [
        {
          text: 'word',
          bbox: { x: 200, y: 50, width: 100, height: 40 }
        }
      ]
      
      const tile = {
        buffer: Buffer.from(''),
        startY: 500,
        width: 1000,
        height: 800
      }
      
      const adjusted = adjustCoordinates(results, tile)
      
      expect(adjusted[0].bbox.x).toBe(200)
    })

    it('adds tile context to results', () => {
      const results: OcrResult[] = [
        {
          text: 'text',
          bbox: { x: 0, y: 0, width: 10, height: 10 }
        }
      ]
      
      const tile = {
        buffer: Buffer.from(''),
        startY: 300,
        width: 500,
        height: 400
      }
      
      const adjusted = adjustCoordinates(results, tile)
      
      expect(adjusted[0].tileContext).toEqual({
        x: 0,
        y: 300,
        width: 500,
        height: 400
      })
    })

    it('handles multiple results', () => {
      const results: OcrResult[] = [
        { text: 'one', bbox: { x: 10, y: 10, width: 20, height: 20 } },
        { text: 'two', bbox: { x: 50, y: 30, width: 30, height: 25 } },
        { text: 'three', bbox: { x: 100, y: 60, width: 40, height: 30 } }
      ]
      
      const tile = {
        buffer: Buffer.from(''),
        startY: 200,
        width: 800,
        height: 600
      }
      
      const adjusted = adjustCoordinates(results, tile)
      
      expect(adjusted).toHaveLength(3)
      expect(adjusted[0].bbox.y).toBe(210)
      expect(adjusted[1].bbox.y).toBe(230)
      expect(adjusted[2].bbox.y).toBe(260)
    })
  })

  describe('filterDuplicates', () => {
    it('keeps single unique result', () => {
      const data: OcrResultWithContext[] = [
        {
          text: 'word',
          bbox: { x: 100, y: 200, width: 50, height: 30 },
          tileContext: { x: 0, y: 0, width: 800, height: 600 }
        }
      ]
      
      const filtered = filterDuplicates(data)
      
      expect(filtered).toHaveLength(1)
      expect(filtered[0].text).toBe('word')
    })

    it('removes exact position duplicates', () => {
      const data: OcrResultWithContext[] = [
        {
          text: 'word1',
          bbox: { x: 100, y: 200, width: 50, height: 30 },
          tileContext: { x: 0, y: 0, width: 800, height: 600 }
        },
        {
          text: 'word2',
          bbox: { x: 100, y: 200, width: 50, height: 30 },
          tileContext: { x: 0, y: 500, width: 800, height: 600 }
        }
      ]
      
      const filtered = filterDuplicates(data)
      
      expect(filtered).toHaveLength(1)
    })

    it('keeps result furthest from tile edges', () => {
      const data: OcrResultWithContext[] = [
        {
          text: 'near-edge',
          bbox: { x: 100, y: 10, width: 50, height: 30 },
          tileContext: { x: 0, y: 0, width: 800, height: 600 }
        },
        {
          text: 'center',
          bbox: { x: 100, y: 10, width: 50, height: 30 },
          tileContext: { x: 0, y: -290, width: 800, height: 600 }
        }
      ]
      
      const filtered = filterDuplicates(data)
      
      expect(filtered).toHaveLength(1)
      expect(filtered[0].text).toBe('center')
    })

    it('preserves different positions', () => {
      const data: OcrResultWithContext[] = [
        {
          text: 'word1',
          bbox: { x: 100, y: 200, width: 50, height: 30 },
          tileContext: { x: 0, y: 0, width: 800, height: 600 }
        },
        {
          text: 'word2',
          bbox: { x: 100, y: 300, width: 50, height: 30 },
          tileContext: { x: 0, y: 0, width: 800, height: 600 }
        },
        {
          text: 'word3',
          bbox: { x: 200, y: 200, width: 50, height: 30 },
          tileContext: { x: 0, y: 0, width: 800, height: 600 }
        }
      ]
      
      const filtered = filterDuplicates(data)
      
      expect(filtered).toHaveLength(3)
    })

    it('removes tile context from output', () => {
      const data: OcrResultWithContext[] = [
        {
          text: 'word',
          bbox: { x: 100, y: 200, width: 50, height: 30 },
          tileContext: { x: 0, y: 0, width: 800, height: 600 }
        }
      ]
      
      const filtered = filterDuplicates(data)
      
      expect(filtered[0]).not.toHaveProperty('tileContext')
      expect(filtered[0]).toHaveProperty('text')
      expect(filtered[0]).toHaveProperty('bbox')
    })
  })
})

