import { describe, it, expect, beforeAll } from 'bun:test'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'
import {
  createAdaptiveTiles,
  adjustCoordinates,
  filterDuplicates,
  needsTiling
} from '@/lib/pipeline/tiling'
import { OcrResult, OcrResultWithContext } from '@/lib/pipeline/types'

const TEST_DATA_DIR = join(__dirname, 'test-data')

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
      
      // Check tiles start positions are non-decreasing (may have overlap)
      for (let i = 1; i < tiles.length; i++) {
        expect(tiles[i].startY).toBeGreaterThanOrEqual(tiles[i - 1].startY)
      }
    })

    it('creates tiles with proper dimensions', async () => {
      const tiles = await createAdaptiveTiles(largeImageBuffer, {
        fileSizeThreshold: 1 * 1024 * 1024, // 1MB (default)
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
        fileSizeThreshold: 1 * 1024 * 1024, // 1MB (default)
      })
      const totalHeight = tiles.reduce((sum, tile) => sum + tile.height, 0)
      
      expect(totalHeight).toBeGreaterThanOrEqual(6000)
    })

    it('creates tiles with overlap between adjacent tiles', async () => {
      const tiles = await createAdaptiveTiles(largeImageBuffer, {
        fileSizeThreshold: 1 * 1024 * 1024, // 1MB (default)
        overlapPercentage: 0.10 // 10% overlap
      })
      
      expect(tiles.length).toBeGreaterThan(1)
      
      // Check that adjacent tiles overlap
      for (let i = 1; i < tiles.length; i++) {
        const prevTile = tiles[i - 1]
        const currTile = tiles[i]
        
        // Previous tile should end after current tile starts (overlap)
        const prevTileEnd = prevTile.startY + prevTile.height
        expect(prevTileEnd).toBeGreaterThan(currTile.startY)
      }
    })

    it('first tile starts at Y=0', async () => {
      const tiles = await createAdaptiveTiles(largeImageBuffer, {
        fileSizeThreshold: 1 * 1024 * 1024, // 1MB (default)
        overlapPercentage: 0.10
      })
      
      expect(tiles[0].startY).toBe(0)
    })

    it('last tile ends at image height', async () => {
      const tiles = await createAdaptiveTiles(largeImageBuffer, {
        fileSizeThreshold: 1 * 1024 * 1024, // 1MB (default)
        overlapPercentage: 0.10
      })
      
      const metadata = await sharp(largeImageBuffer).metadata()
      const lastTile = tiles[tiles.length - 1]
      const lastTileEnd = lastTile.startY + lastTile.height
      
      expect(lastTileEnd).toBe(metadata.height)
    })

    it('overlap size is approximately correct based on overlapPercentage', async () => {
      const overlapPercentage = 0.15 // 15%
      const tiles = await createAdaptiveTiles(largeImageBuffer, {
        fileSizeThreshold: 1 * 1024 * 1024, // 1MB (default)
        overlapPercentage
      })
      
      if (tiles.length > 1) {
        // Calculate overlap between first two tiles
        const tile0End = tiles[0].startY + tiles[0].height
        const tile1Start = tiles[1].startY
        const actualOverlap = tile0End - tile1Start
        
        // Get metadata to calculate base tile height
        const metadata = await sharp(largeImageBuffer).metadata()
        const excessRatio = largeImageBuffer.length / (1 * 1024 * 1024)
        const baseDivisions = Math.ceil(excessRatio)
        const baseTileHeight = Math.floor(metadata.height! / baseDivisions)
        
        // Expected overlap should be approximately 15% of base tile height
        // Overlap appears twice: tile0 extends down, tile1 starts up
        const expectedOverlap = Math.floor(baseTileHeight * overlapPercentage) * 2
        
        // Allow some tolerance (within 5 pixels due to rounding)
        expect(Math.abs(actualOverlap - expectedOverlap)).toBeLessThanOrEqual(5)
      }
    })

    it('tiles with overlap still cover entire image', async () => {
      const tiles = await createAdaptiveTiles(largeImageBuffer, {
        fileSizeThreshold: 1 * 1024 * 1024, // 1MB (default)
        overlapPercentage: 0.20 // 20% overlap
      })
      
      const metadata = await sharp(largeImageBuffer).metadata()
      
      // First tile should start at 0
      expect(tiles[0].startY).toBe(0)
      
      // Last tile should end at image height
      const lastTile = tiles[tiles.length - 1]
      const lastTileEnd = lastTile.startY + lastTile.height
      expect(lastTileEnd).toBe(metadata.height)
      
      // All intermediate tiles should have overlaps
      for (let i = 1; i < tiles.length; i++) {
        const prevEnd = tiles[i - 1].startY + tiles[i - 1].height
        const currStart = tiles[i].startY
        expect(prevEnd).toBeGreaterThan(currStart)
      }
    })

    it('respects custom overlapPercentage', async () => {
      const smallOverlap = await createAdaptiveTiles(largeImageBuffer, {
        fileSizeThreshold: 1 * 1024 * 1024, // 1MB (default)
        overlapPercentage: 0.05 // 5%
      })
      
      const largeOverlap = await createAdaptiveTiles(largeImageBuffer, {
        fileSizeThreshold: 1 * 1024 * 1024, // 1MB (default)
        overlapPercentage: 0.25 // 25%
      })
      
      if (smallOverlap.length > 1 && largeOverlap.length > 1) {
        // Calculate overlaps
        const smallOverlapSize = 
          (smallOverlap[0].startY + smallOverlap[0].height) - smallOverlap[1].startY
        const largeOverlapSize = 
          (largeOverlap[0].startY + largeOverlap[0].height) - largeOverlap[1].startY
        
        // Large overlap should be greater than small overlap
        expect(largeOverlapSize).toBeGreaterThan(smallOverlapSize)
      }
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

    it('deduplicates with X within 2px, Y within tolerance, width within 2px', () => {
      const data: OcrResultWithContext[] = [
        {
          text: 'word',
          bbox: { x: 100, y: 200, width: 50, height: 30 },
          tileContext: { x: 0, y: 0, width: 800, height: 600 }
        },
        {
          text: 'word',
          bbox: { x: 101, y: 206, width: 51, height: 30 },
          tileContext: { x: 0, y: 500, width: 800, height: 600 }
        }
      ]
      
      const filtered = filterDuplicates(data)
      
      expect(filtered).toHaveLength(1)
    })

    it('preserves entries when X beyond 2px', () => {
      const data: OcrResultWithContext[] = [
        {
          text: 'word',
          bbox: { x: 100, y: 200, width: 50, height: 30 },
          tileContext: { x: 0, y: 0, width: 800, height: 600 }
        },
        {
          text: 'word',
          bbox: { x: 103, y: 200, width: 50, height: 30 },
          tileContext: { x: 0, y: 0, width: 800, height: 600 }
        }
      ]
      
      const filtered = filterDuplicates(data)
      
      expect(filtered).toHaveLength(2)
    })

    it('preserves entries when Y beyond tolerance', () => {
      const data: OcrResultWithContext[] = [
        {
          text: 'word',
          bbox: { x: 100, y: 200, width: 50, height: 30 },
          tileContext: { x: 0, y: 0, width: 800, height: 600 }
        },
        {
          text: 'word',
          bbox: { x: 100, y: 250, width: 50, height: 30 },
          tileContext: { x: 0, y: 0, width: 800, height: 600 }
        }
      ]
      
      const filtered = filterDuplicates(data)
      
      expect(filtered).toHaveLength(2)
    })

    it('preserves entries when width beyond 2px', () => {
      const data: OcrResultWithContext[] = [
        {
          text: 'word',
          bbox: { x: 100, y: 200, width: 50, height: 30 },
          tileContext: { x: 0, y: 0, width: 800, height: 600 }
        },
        {
          text: 'word',
          bbox: { x: 100, y: 200, width: 53, height: 30 },
          tileContext: { x: 0, y: 0, width: 800, height: 600 }
        }
      ]
      
      const filtered = filterDuplicates(data)
      
      expect(filtered).toHaveLength(2)
    })

    it('keeps result furthest from tile edges when duplicates found', () => {
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

    it('handles empty input', () => {
      const filtered = filterDuplicates([])
      expect(filtered).toHaveLength(0)
    })
  })

  describe('integration with real images', () => {
    let mainSampleBuffer: Buffer
    let largeSampleBuffer: Buffer

    beforeAll(async () => {
      mainSampleBuffer = await readFile(join(TEST_DATA_DIR, 'main-sample.jpg'))
      largeSampleBuffer = await readFile(join(TEST_DATA_DIR, 'large-sample.jpg'))
    })

    it('main-sample.jpg does not need tiling at 1MB threshold', () => {
      // main-sample.jpg is 845KB
      expect(needsTiling(mainSampleBuffer)).toBe(false)
    })

    it('large-sample.jpg needs tiling at 1MB threshold', () => {
      // large-sample.jpg is 1.8MB
      expect(needsTiling(largeSampleBuffer)).toBe(true)
    })

    it('creates single tile for main-sample.jpg', async () => {
      const tiles = await createAdaptiveTiles(mainSampleBuffer)

      expect(tiles).toHaveLength(1)
      expect(tiles[0].startY).toBe(0)
    })

    it('creates multiple tiles for large-sample.jpg', async () => {
      const tiles = await createAdaptiveTiles(largeSampleBuffer)

      expect(tiles.length).toBeGreaterThan(1)
    })

    it('tiles cover full height of large-sample.jpg', async () => {
      const tiles = await createAdaptiveTiles(largeSampleBuffer)
      const metadata = await sharp(largeSampleBuffer).metadata()

      const totalHeight = tiles.reduce((sum, tile) => sum + tile.height, 0)
      expect(totalHeight).toBeGreaterThanOrEqual(metadata.height!)
    })

    it('all tiles have valid buffers', async () => {
      const tiles = await createAdaptiveTiles(largeSampleBuffer)

      for (const tile of tiles) {
        expect(tile.buffer.length).toBeGreaterThan(0)
        const metadata = await sharp(tile.buffer).metadata()
        expect(metadata.width).toBeGreaterThan(0)
        expect(metadata.height).toBe(tile.height)
      }
    })
  })

  describe('integration with real OCR data', () => {
    let largeOcrData: OcrResult[]

    beforeAll(async () => {
      const ocrPath = join(TEST_DATA_DIR, 'largeImageOcrOutput.json')
      largeOcrData = JSON.parse(await readFile(ocrPath, 'utf-8'))
    })

    it('adjusts coordinates for simulated tiles', () => {
      // Take first 10 results as if from first tile
      const tileResults = largeOcrData.slice(0, 10)
      const tile = {
        buffer: Buffer.from(''),
        startY: 1000,
        width: 800,
        height: 600
      }

      const adjusted = adjustCoordinates(tileResults, tile)

      expect(adjusted).toHaveLength(10)
      // Y should be offset by tile startY
      expect(adjusted[0].bbox.y).toBe(tileResults[0].bbox.y + 1000)
      // X should be preserved
      expect(adjusted[0].bbox.x).toBe(tileResults[0].bbox.x)
    })

    it('filters duplicates from overlapping tile regions', () => {
      // Simulate two tiles with overlapping results
      const overlap: OcrResultWithContext[] = [
        {
          ...largeOcrData[0],
          tileContext: { x: 0, y: 0, width: 800, height: 600 }
        },
        {
          ...largeOcrData[0], // Same position = duplicate
          tileContext: { x: 0, y: 400, width: 800, height: 600 }
        }
      ]

      const filtered = filterDuplicates(overlap)
      expect(filtered).toHaveLength(1)
    })

    it('preserves unique results from different positions', () => {
      // All unique positions should be preserved
      const unique: OcrResultWithContext[] = largeOcrData
        .slice(0, 5)
        .map(r => ({
          ...r,
          tileContext: { x: 0, y: 0, width: 800, height: 1000 }
        }))

      const filtered = filterDuplicates(unique)
      expect(filtered).toHaveLength(5)
    })
  })

  describe('tiling with row images and output verification', () => {
    let row2ImageBuffer: Buffer

    beforeAll(async () => {
      row2ImageBuffer = await readFile(
        join(TEST_DATA_DIR, 'row-2-column-1.jpg')
      )
    })

    it('checks if row-2-column-1.jpg needs tiling', () => {
      const fileSize = row2ImageBuffer.length
      const threshold = 1 * 1024 * 1024 // 1MB
      const needsTilingResult = needsTiling(row2ImageBuffer, threshold)
      
      expect(typeof needsTilingResult).toBe('boolean')
      expect(fileSize).toBeGreaterThan(0)
    })

    it('creates tiles from row-2-column-1.jpg with low threshold', async () => {
      const tiles = await createAdaptiveTiles(row2ImageBuffer, {
        fileSizeThreshold: 500 * 1024 // 500KB - force tiling
      })

      expect(tiles.length).toBeGreaterThan(0)
      
      const metadata = await sharp(row2ImageBuffer).metadata()
      const totalHeight = tiles.reduce((sum, tile) => sum + tile.height, 0)
      
      expect(totalHeight).toBeGreaterThanOrEqual(metadata.height!)
      
      for (const tile of tiles) {
        expect(tile.buffer.length).toBeGreaterThan(0)
        expect(tile.width).toBe(metadata.width)
        expect(tile.height).toBeGreaterThan(0)
      }
    })

    it('outputs split tiles to files for manual verification', async () => {
      const tiles = await createAdaptiveTiles(row2ImageBuffer, {
        fileSizeThreshold: 500 * 1024 // 500KB - force tiling
      })

      expect(tiles.length).toBeGreaterThan(0)

      const outputDir = TEST_DATA_DIR
      const metadata = await sharp(row2ImageBuffer).metadata()
      
      const outputInfo = {
        sourceImage: 'row-2-column-1.jpg',
        sourceDimensions: {
          width: metadata.width,
          height: metadata.height,
          fileSize: row2ImageBuffer.length
        },
        threshold: 500 * 1024,
        tileCount: tiles.length,
        tiles: tiles.map((tile, index) => ({
          index,
          startY: tile.startY,
          width: tile.width,
          height: tile.height,
          bufferSize: tile.buffer.length,
          outputFile: `row-2-column-1-tile-${index}.jpg`
        }))
      }

      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i]
        const outputPath = join(outputDir, `row-2-column-1-tile-${i}.jpg`)
        await writeFile(outputPath, tile.buffer)
      }

      const infoPath = join(outputDir, 'row-2-column-1-tiles-info.json')
      await writeFile(infoPath, JSON.stringify(outputInfo, null, 2))

      expect(tiles.length).toBeGreaterThan(0)
    })

    it('validates tile sequence and coverage', async () => {
      const tiles = await createAdaptiveTiles(row2ImageBuffer, {
        fileSizeThreshold: 500 * 1024
      })

      const metadata = await sharp(row2ImageBuffer).metadata()
      const imageHeight = metadata.height!

      expect(tiles[0].startY).toBe(0)

      for (let i = 1; i < tiles.length; i++) {
        expect(tiles[i].startY).toBeGreaterThanOrEqual(tiles[i - 1].startY)
        expect(tiles[i].startY).toBeLessThanOrEqual(imageHeight)
        
        // Verify overlap (previous tile should end after current starts)
        const prevTileEnd = tiles[i - 1].startY + tiles[i - 1].height
        expect(prevTileEnd).toBeGreaterThan(tiles[i].startY)
      }

      const lastTile = tiles[tiles.length - 1]
      expect(lastTile.startY + lastTile.height).toBeGreaterThanOrEqual(
        imageHeight
      )
    })
  })

  describe('tiling solo-leveling-chapter-1 stitched image', () => {
    it('creates tiles from stitched image and outputs to directory', async () => {
      const stitchedImagePath = join(
        TEST_DATA_DIR,
        'solo-leveling-chapter-1-stitched.png'
      )
      const stitchedImageBuffer = await readFile(stitchedImagePath)

      const tiles = await createAdaptiveTiles(stitchedImageBuffer, {
        fileSizeThreshold: 1 * 1024 * 1024 // 1MB
      })

      expect(tiles.length).toBeGreaterThan(0)

      const outputDir = join(TEST_DATA_DIR, 'solo-leveling-chapter-1-tiles')
      await mkdir(outputDir, { recursive: true })

      const metadata = await sharp(stitchedImageBuffer).metadata()

      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i]
        const outputPath = join(outputDir, `tile-${i}.jpg`)
        await writeFile(outputPath, tile.buffer)
      }

      const totalHeight = tiles.reduce((sum, tile) => sum + tile.height, 0)
      expect(totalHeight).toBeGreaterThanOrEqual(metadata.height!)

      const infoPath = join(outputDir, 'tiles-info.json')
      const outputInfo = {
        sourceImage: 'solo-leveling-chapter-1-stitched.png',
        sourceDimensions: {
          width: metadata.width,
          height: metadata.height,
          fileSize: stitchedImageBuffer.length
        },
        threshold: 1 * 1024 * 1024,
        tileCount: tiles.length,
        tiles: tiles.map((tile, index) => ({
          index,
          startY: tile.startY,
          width: tile.width,
          height: tile.height,
          bufferSize: tile.buffer.length
        }))
      }
      await writeFile(infoPath, JSON.stringify(outputInfo, null, 2))
    })
  })
})

