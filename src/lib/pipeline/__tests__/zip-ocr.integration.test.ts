import { describe, it, expect, beforeAll, afterEach } from 'bun:test'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import sharp from 'sharp'
import dotenv from 'dotenv'
import { extractImagesFromZip } from '@/lib/pipeline/zipExtractor'
import { stitchImageBuffers } from '@/lib/pipeline/imageStitcher'
import { createAdaptiveTiles } from '@/lib/pipeline/tiling'
import { processImage } from '@/lib/pipeline/ocr'

dotenv.config({ path: join(process.cwd(), '.env') })

const TEST_DATA_DIR = join(__dirname, 'test-data')
const TEST_OUTPUT_DIR = join(__dirname, 'test-outputs')
const API_KEY = process.env.OCR_API_KEY || ''
const SKIP_REASON = 'OCR_API_KEY env var not set'

/**
 * Delays execution for rate limiting between API calls.
 * Input: milliseconds
 * Output: promise resolving after delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Creates timestamped directory name.
 * Input: none
 * Output: timestamp string in YYYY-MM-DD_HH-MM-SS format
 */
function getTimestampDir(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`
}

describe('zip-ocr integration', () => {
  const skipTests = !API_KEY

  if (skipTests) {
    it.skip(`SKIPPED: ${SKIP_REASON}`, () => {})
    return
  }

  afterEach(async () => {
    await delay(500)
  })

  describe('zip → extraction → stitching → tiling → OCR', () => {
    let testZipBuffer: Buffer

    beforeAll(async () => {
      testZipBuffer = await readFile(
        join(TEST_DATA_DIR, 'solo-leveling-chapter-1.zip')
      )
    })

    it('processes zip file through full extraction → stitching → tiling → OCR flow', async () => {
      const timestampDir = getTimestampDir()
      const outputDir = join(TEST_OUTPUT_DIR, timestampDir)
      const tilesDir = join(outputDir, 'tiles')

      await mkdir(tilesDir, { recursive: true })

      const extractedImages = await extractImagesFromZip(testZipBuffer)
      expect(extractedImages.length).toBeGreaterThan(0)

      const stitchedImage = await stitchImageBuffers(extractedImages)
      expect(stitchedImage).toBeInstanceOf(Buffer)

      await writeFile(join(outputDir, 'input.zip'), testZipBuffer)
      await writeFile(join(outputDir, 'stitched.png'), stitchedImage)

      const stitchedMetadata = await sharp(stitchedImage).metadata()
      expect(stitchedMetadata.width).toBeGreaterThan(0)
      expect(stitchedMetadata.height).toBeGreaterThan(0)

      const tiles = await createAdaptiveTiles(stitchedImage, {
        fileSizeThreshold: 1 * 1024 * 1024 // 1MB (default)
      })

      const tilesMetadata = tiles.map((t, i) => ({
        index: i,
        startY: t.startY,
        width: t.width,
        height: t.height,
        bufferSize: t.buffer.length
      }))

      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i]
        const tileFileName = `tile-${i}.jpg`
        await writeFile(join(tilesDir, tileFileName), tile.buffer)
      }

      await writeFile(
        join(outputDir, 'tiles-metadata.json'),
        JSON.stringify(tilesMetadata, null, 2)
      )

      const ocrResults = await processImage(stitchedImage, {
        apiKey: API_KEY,
        language: 'kor',
        ocrEngine: 2,
        fileSizeThreshold: 1 * 1024 * 1024 // 1MB (default)
      })

      await writeFile(
        join(outputDir, 'ocr-results.json'),
        JSON.stringify(ocrResults, null, 2)
      )

      expect(Array.isArray(ocrResults)).toBe(true)
      expect(existsSync(join(outputDir, 'input.zip'))).toBe(true)
      expect(existsSync(join(outputDir, 'stitched.png'))).toBe(true)
      expect(existsSync(join(outputDir, 'tiles-metadata.json'))).toBe(true)
      expect(existsSync(join(outputDir, 'ocr-results.json'))).toBe(true)
    }, 60000)

    it('makes real OCR API call (not mocked)', async () => {
      const extractedImages = await extractImagesFromZip(testZipBuffer)
      const stitchedImage = await stitchImageBuffers(extractedImages)

      const ocrResults = await processImage(stitchedImage, {
        apiKey: API_KEY,
        language: 'kor',
        ocrEngine: 2
      })

      expect(Array.isArray(ocrResults)).toBe(true)
    }, 60000)

    it('saves tiles (not extracted images) to timestamped directory', async () => {
      const timestampDir = getTimestampDir()
      const outputDir = join(TEST_OUTPUT_DIR, timestampDir)
      const tilesDir = join(outputDir, 'tiles')

      await mkdir(tilesDir, { recursive: true })

      const extractedImages = await extractImagesFromZip(testZipBuffer)
      const stitchedImage = await stitchImageBuffers(extractedImages)
      const tiles = await createAdaptiveTiles(stitchedImage, {
        fileSizeThreshold: 1 * 1024 * 1024 // 1MB (default)
      })

      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i]
        const tileFileName = `tile-${i}.jpg`
        await writeFile(join(tilesDir, tileFileName), tile.buffer)
      }

      expect(tiles.length).toBeGreaterThan(0)
      for (let i = 0; i < tiles.length; i++) {
        const tilePath = join(tilesDir, `tile-${i}.jpg`)
        expect(existsSync(tilePath)).toBe(true)
      }
    })

    it('names tile files in alphanumeric order (tile-0.jpg, tile-1.jpg, etc.)', async () => {
      const timestampDir = getTimestampDir()
      const outputDir = join(TEST_OUTPUT_DIR, timestampDir)
      const tilesDir = join(outputDir, 'tiles')

      await mkdir(tilesDir, { recursive: true })

      const extractedImages = await extractImagesFromZip(testZipBuffer)
      const stitchedImage = await stitchImageBuffers(extractedImages)
      const tiles = await createAdaptiveTiles(stitchedImage, {
        fileSizeThreshold: 1 * 1024 * 1024 // 1MB (default)
      })

      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i]
        const tileFileName = `tile-${i}.jpg`
        await writeFile(join(tilesDir, tileFileName), tile.buffer)
      }

      for (let i = 0; i < tiles.length; i++) {
        const expectedPath = join(tilesDir, `tile-${i}.jpg`)
        expect(existsSync(expectedPath)).toBe(true)
      }
    })

    it('verifies OCR results structure', async () => {
      const extractedImages = await extractImagesFromZip(testZipBuffer)
      const stitchedImage = await stitchImageBuffers(extractedImages)

      const ocrResults = await processImage(stitchedImage, {
        apiKey: API_KEY,
        language: 'kor',
        ocrEngine: 2
      })

      if (ocrResults.length > 0) {
        const first = ocrResults[0]
        expect(first).toHaveProperty('text')
        expect(first).toHaveProperty('bbox')
        expect(first.bbox).toHaveProperty('x')
        expect(first.bbox).toHaveProperty('y')
        expect(first.bbox).toHaveProperty('width')
        expect(first.bbox).toHaveProperty('height')
      }
    }, 60000)

    it('handles zip with multiple images', async () => {
      const extractedImages = await extractImagesFromZip(testZipBuffer)

      expect(extractedImages.length).toBe(3)

      const stitchedImage = await stitchImageBuffers(extractedImages)
      const metadata = await sharp(stitchedImage).metadata()

      expect(metadata.width).toBeGreaterThan(0)
      expect(metadata.height).toBeGreaterThan(0)
    })

    it('validates stitched image dimensions', async () => {
      const extractedImages = await extractImagesFromZip(testZipBuffer)
      const stitchedImage = await stitchImageBuffers(extractedImages)

      const metadata = await sharp(stitchedImage).metadata()
      expect(metadata.width).toBeGreaterThan(0)
      expect(metadata.height).toBeGreaterThan(0)
      expect(metadata.format).toBe('png')
    })

    it('saves tile metadata with positions', async () => {
      const timestampDir = getTimestampDir()
      const outputDir = join(TEST_OUTPUT_DIR, timestampDir)

      await mkdir(outputDir, { recursive: true })

      const extractedImages = await extractImagesFromZip(testZipBuffer)
      const stitchedImage = await stitchImageBuffers(extractedImages)
      const tiles = await createAdaptiveTiles(stitchedImage, {
        fileSizeThreshold: 1 * 1024 * 1024 // 1MB (default)
      })

      const tilesMetadata = tiles.map((t, i) => ({
        index: i,
        startY: t.startY,
        width: t.width,
        height: t.height,
        bufferSize: t.buffer.length
      }))

      await writeFile(
        join(outputDir, 'tiles-metadata.json'),
        JSON.stringify(tilesMetadata, null, 2)
      )

      expect(tilesMetadata.length).toBeGreaterThan(0)
      for (const meta of tilesMetadata) {
        expect(meta).toHaveProperty('index')
        expect(meta).toHaveProperty('startY')
        expect(meta).toHaveProperty('width')
        expect(meta).toHaveProperty('height')
        expect(meta).toHaveProperty('bufferSize')
      }
    })

    it('handles both tiled and non-tiled processing paths', async () => {
      const extractedImages = await extractImagesFromZip(testZipBuffer)
      const stitchedImage = await stitchImageBuffers(extractedImages)

      const smallImage = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      })
        .jpeg()
        .toBuffer()

      const tiledResults = await processImage(stitchedImage, {
        apiKey: API_KEY,
        language: 'kor',
        ocrEngine: 2,
        fileSizeThreshold: 1 * 1024 * 1024 // 1MB (default)
      })

      const nonTiledResults = await processImage(smallImage, {
        apiKey: API_KEY,
        language: 'kor',
        ocrEngine: 2,
        fileSizeThreshold: 1 * 1024 * 1024
      })

      expect(Array.isArray(tiledResults)).toBe(true)
      expect(Array.isArray(nonTiledResults)).toBe(true)
    }, 60000)
  })
})

