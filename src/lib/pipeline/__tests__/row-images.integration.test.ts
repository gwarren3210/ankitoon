import { describe, it, expect, beforeAll, afterEach } from 'bun:test'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { processImage } from '@/lib/pipeline/ocr'
import { OcrResult } from '@/lib/pipeline/types'
import dotenv from 'dotenv'
dotenv.config({ path: join(process.cwd(), '.env') })


const TEST_DATA_DIR = join(__dirname, 'test-data')
const OUTPUT_DIR = join(__dirname, 'test-data')
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
 * Writes OCR results to a JSON file for manual verification.
 * Input: results array, output file path
 * Output: void
 */
async function writeResultsToFile(
  results: OcrResult[],
  outputPath: string
): Promise<void> {
  const output = {
    timestamp: new Date().toISOString(),
    totalResults: results.length,
    results: results.map(r => ({
      text: r.text,
      bbox: r.bbox
    }))
  }
  await writeFile(outputPath, JSON.stringify(output, null, 2))
}

describe('Row Images Integration Tests', () => {
  const skipTests = !API_KEY

  if (skipTests) {
    it.skip(`SKIPPED: ${SKIP_REASON}`, () => {})
    return
  }

  afterEach(async () => {
    await delay(500)
  })

  describe('row-1-column-1.jpg', () => {
    let imageBuffer: Buffer

    beforeAll(async () => {
      imageBuffer = await readFile(
        join(TEST_DATA_DIR, 'row-1-column-1.jpg')
      )
    })

    it('processes and writes results to file for manual verification', async () => {
      const results = await processImage(imageBuffer, {
        apiKey: API_KEY,
        language: 'kor',
        ocrEngine: 2
      })

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)

      for (const r of results) {
        expect(r).toHaveProperty('text')
        expect(r).toHaveProperty('bbox')
        expect(typeof r.text).toBe('string')
        expect(typeof r.bbox.x).toBe('number')
        expect(typeof r.bbox.y).toBe('number')
        expect(typeof r.bbox.width).toBe('number')
        expect(typeof r.bbox.height).toBe('number')
      }

      const outputPath = join(OUTPUT_DIR, 'row-1-column-1-output.json')
      await writeResultsToFile(results, outputPath)
    }, 60000)
  })

  describe('row-2-column-1.jpg', () => {
    let imageBuffer: Buffer

    beforeAll(async () => {
      imageBuffer = await readFile(
        join(TEST_DATA_DIR, 'row-2-column-1.jpg')
      )
    })

    it('processes and writes results to file for manual verification', async () => {
      const results = await processImage(imageBuffer, {
        apiKey: API_KEY,
        language: 'kor',
        ocrEngine: 2
      })

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)

      for (const r of results) {
        expect(r).toHaveProperty('text')
        expect(r).toHaveProperty('bbox')
        expect(typeof r.text).toBe('string')
        expect(typeof r.bbox.x).toBe('number')
        expect(typeof r.bbox.y).toBe('number')
        expect(typeof r.bbox.width).toBe('number')
        expect(typeof r.bbox.height).toBe('number')
      }

      const outputPath = join(OUTPUT_DIR, 'row-2-column-1-output.json')
      await writeResultsToFile(results, outputPath)
    }, 60000)
  })

  describe('row-3-column-1.jpg', () => {
    let imageBuffer: Buffer

    beforeAll(async () => {
      imageBuffer = await readFile(
        join(TEST_DATA_DIR, 'row-3-column-1.jpg')
      )
    })

    it('processes and writes results to file for manual verification', async () => {
      const results = await processImage(imageBuffer, {
        apiKey: API_KEY,
        language: 'kor',
        ocrEngine: 2
      })

      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThan(0)

      for (const r of results) {
        expect(r).toHaveProperty('text')
        expect(r).toHaveProperty('bbox')
        expect(typeof r.text).toBe('string')
        expect(typeof r.bbox.x).toBe('number')
        expect(typeof r.bbox.y).toBe('number')
        expect(typeof r.bbox.width).toBe('number')
        expect(typeof r.bbox.height).toBe('number')
      }

      const outputPath = join(OUTPUT_DIR, 'row-3-column-1-output.json')
      await writeResultsToFile(results, outputPath)
    }, 60000)
  })
})

