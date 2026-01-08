import { describe, it, expect, beforeAll, afterEach } from 'bun:test'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { processImage, callOcrSpaceApi } from '@/lib/pipeline/ocr'
import sharp from 'sharp'
import dotenv from 'dotenv'
dotenv.config({ path: join(process.cwd(), '.env') })

const TEST_DATA_DIR = join(__dirname, 'test-data')
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

describe('OCR Space Integration Tests', () => {
  // Skip all tests if API key not set
  const skipTests = !API_KEY

  if (skipTests) {
    it.skip(`SKIPPED: ${SKIP_REASON}`, () => {})
    return
  }

  afterEach(async () => {
    // Rate limiting between tests
    await delay(500)
  })

  describe('callOcrSpaceApi', () => {
    let smallImageBase64: string

    beforeAll(async () => {
      const buffer = await readFile(join(TEST_DATA_DIR, 'main-sample.jpg'))
      smallImageBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`
    })

    it('returns valid response for base64 image', async () => {
      const result = await callOcrSpaceApi(smallImageBase64, {
        apiKey: API_KEY,
        language: 'kor',
        ocrEngine: '2',
        scale: true,
        isOverlayRequired: true,
        filetype: 'JPG'
      })

      expect(result).toBeDefined()
      expect(result.OCRExitCode).toBe(1)
      expect(result.ParsedResults).toBeDefined()
      expect(Array.isArray(result.ParsedResults)).toBe(true)
    })

    it('returns TextOverlay when isOverlayRequired is true', async () => {
      const result = await callOcrSpaceApi(smallImageBase64, {
        apiKey: API_KEY,
        language: 'kor',
        ocrEngine: '2',
        scale: true,
        isOverlayRequired: true
      })

      expect(result.OCRExitCode).toBe(1)
      expect(result.ParsedResults?.[0]?.TextOverlay).toBeDefined()
    })

    it('handles OCR Engine 1', async () => {
      const result = await callOcrSpaceApi(smallImageBase64, {
        apiKey: API_KEY,
        language: 'kor',
        ocrEngine: '1',
        scale: true,
        isOverlayRequired: true
      })

      expect(result.OCRExitCode).toBe(1)
    })

    it('handles OCR Engine 2', async () => {
      const result = await callOcrSpaceApi(smallImageBase64, {
        apiKey: API_KEY,
        language: 'kor',
        ocrEngine: '2',
        scale: true,
        isOverlayRequired: true
      })

      expect(result.OCRExitCode).toBe(1)
    })

    it('fails with invalid API key', async () => {
      const result = await callOcrSpaceApi(smallImageBase64, {
        apiKey: 'invalid-key-12345',
        language: 'kor',
        ocrEngine: '2',
        scale: true,
        isOverlayRequired: true
      })

      // OCR.space returns OCRExitCode !== 1 for auth errors
      expect(result.OCRExitCode).not.toBe(1)
    })

    it('throws for invalid input format', async () => {
      expect(
        await callOcrSpaceApi('/invalid/path.jpg', {
          apiKey: API_KEY,
          language: 'kor',
          ocrEngine: '2',
          scale: true,
          isOverlayRequired: true
        })
      ).rejects.toThrow('Invalid input')
    })
  })

  describe('processImage - single image', () => {
    let mainSampleBuffer: Buffer

    beforeAll(async () => {
      mainSampleBuffer = await readFile(join(TEST_DATA_DIR, 'main-sample.jpg'))
    })

    it('processes main-sample.jpg successfully', async () => {
      const results = await processImage(mainSampleBuffer, {
        apiKey: API_KEY,
        language: 'kor',
        ocrEngine: 2
      })

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)
    })

    it('returns results with correct structure', async () => {
      const results = await processImage(mainSampleBuffer, {
        apiKey: API_KEY,
        language: 'kor'
      })

      if (results.length > 0) {
        const first = results[0]
        expect(first).toHaveProperty('text')
        expect(first).toHaveProperty('bbox')
        expect(first.bbox).toHaveProperty('x')
        expect(first.bbox).toHaveProperty('y')
        expect(first.bbox).toHaveProperty('width')
        expect(first.bbox).toHaveProperty('height')
      }
    })

    it('extracts Korean text correctly', async () => {
      const results = await processImage(mainSampleBuffer, {
        apiKey: API_KEY,
        language: 'kor',
        ocrEngine: 2
      })

      // Check that at least some results contain Korean characters
      const hasKorean = results.some(r => /[\uAC00-\uD7AF]/.test(r.text))
      expect(hasKorean).toBe(true)
    })
  })

  describe('processImage - tiled processing', () => {
    let largeSampleBuffer: Buffer

    beforeAll(async () => {
      largeSampleBuffer = await readFile(
        join(TEST_DATA_DIR, 'large-sample.jpg')
      )
    })

    it('processes large-sample.jpg with tiling', async () => {
      const results = await processImage(largeSampleBuffer, {
        apiKey: API_KEY,
        language: 'kor',
        ocrEngine: 2,
        fileSizeThreshold: 1 * 1024 * 1024 // 1MB (default)
      })

      expect(Array.isArray(results)).toBe(true)
    }, 60000) // Extended timeout for tiled processing

    it('returns deduplicated results', async () => {
      const results = await processImage(largeSampleBuffer, {
        apiKey: API_KEY,
        language: 'kor',
        ocrEngine: 2,
        fileSizeThreshold: 1 * 1024 * 1024 // 1MB (default)
      })

      // Check for no exact duplicates
      const seen = new Set<string>()
      let hasDuplicates = false

      for (const r of results) {
        const key = `${r.text}:${r.bbox.x}:${r.bbox.y}`
        if (seen.has(key)) {
          hasDuplicates = true
          break
        }
        seen.add(key)
      }

      expect(hasDuplicates).toBe(false)
    }, 60000)
  })

  describe('processImage - engine comparison', () => {
    let mainSampleBuffer: Buffer

    beforeAll(async () => {
      mainSampleBuffer = await readFile(join(TEST_DATA_DIR, 'main-sample.jpg'))
    })

    it('Engine 1 returns results', async () => {
      const results = await processImage(mainSampleBuffer, {
        apiKey: API_KEY,
        language: 'kor',
        ocrEngine: 1
      })

      expect(Array.isArray(results)).toBe(true)
    })

    it('Engine 2 returns results', async () => {
      const results = await processImage(mainSampleBuffer, {
        apiKey: API_KEY,
        language: 'kor',
        ocrEngine: 2
      })

      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('processImage - scale parameter', () => {
    let mainSampleBuffer: Buffer

    beforeAll(async () => {
      mainSampleBuffer = await readFile(join(TEST_DATA_DIR, 'main-sample.jpg'))
    })

    it('works with scale=true', async () => {
      const results = await processImage(mainSampleBuffer, {
        apiKey: API_KEY,
        language: 'kor',
        scale: true
      })

      expect(Array.isArray(results)).toBe(true)
    })

    it('works with scale=false', async () => {
      const results = await processImage(mainSampleBuffer, {
        apiKey: API_KEY,
        language: 'kor',
        scale: false
      })

      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe('processImage - error handling', () => {
    it('throws error for missing API key', async () => {
      const buffer = await sharp({
        create: { width: 100, height: 100, channels: 3, background: '#fff' }
      }).jpeg().toBuffer()

      await expect(
        processImage(buffer, { apiKey: '' })
      ).rejects.toThrow('OCR_API_KEY not configured')
    })

    it('handles malformed image gracefully', async () => {
      const badBuffer = Buffer.from('not an image')

      await expect(
        processImage(badBuffer, { apiKey: API_KEY })
      ).rejects.toThrow()
    })
  })

  describe('response format validation', () => {
    let mainSampleBuffer: Buffer

    beforeAll(async () => {
      mainSampleBuffer = await readFile(join(TEST_DATA_DIR, 'main-sample.jpg'))
    })

    it('bbox coordinates are numbers', async () => {
      const results = await processImage(mainSampleBuffer, {
        apiKey: API_KEY,
        language: 'kor'
      })

      for (const r of results) {
        expect(typeof r.bbox.x).toBe('number')
        expect(typeof r.bbox.y).toBe('number')
        expect(typeof r.bbox.width).toBe('number')
        expect(typeof r.bbox.height).toBe('number')
      }
    })

    it('bbox coordinates are non-negative', async () => {
      const results = await processImage(mainSampleBuffer, {
        apiKey: API_KEY,
        language: 'kor'
      })

      for (const r of results) {
        expect(r.bbox.x).toBeGreaterThanOrEqual(0)
        expect(r.bbox.y).toBeGreaterThanOrEqual(0)
        expect(r.bbox.width).toBeGreaterThanOrEqual(0)
        expect(r.bbox.height).toBeGreaterThanOrEqual(0)
      }
    })

    it('text values are non-empty strings', async () => {
      const results = await processImage(mainSampleBuffer, {
        apiKey: API_KEY,
        language: 'kor'
      })

      for (const r of results) {
        expect(typeof r.text).toBe('string')
        expect(r.text.length).toBeGreaterThan(0)
      }
    })
  })
})

