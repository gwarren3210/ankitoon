import { describe, it, expect, beforeAll } from 'bun:test'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import * as os from 'os'
import dotenv from 'dotenv'
import {
  createAdaptiveTiles,
  adjustCoordinates,
  filterDuplicates
} from '@/lib/pipeline/tiling'
import {
  callOcrSpaceApi,
  parseOcrResponse,
  detectImageFormat
} from '@/lib/pipeline/ocr'
import { OcrResultWithContext } from '@/lib/pipeline/types'

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

/**
 * Creates timestamped temp directory for test artifacts.
 * Output: temp directory path
 */
async function createTempDir(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const tempDir = join(os.tmpdir(), `tiling-ocr-e2e-${timestamp}`)
  await mkdir(tempDir, { recursive: true })
  return tempDir
}

/**
 * Saves buffer to temp directory with numbered prefix.
 * Input: temp dir, prefix number, name, buffer
 * Output: void
 */
async function saveBufferToTemp(
  tempDir: string,
  prefix: number,
  name: string,
  buffer: Buffer
): Promise<void> {
  const paddedPrefix = String(prefix).padStart(2, '0')
  const ext = name.endsWith('.png') ? '.png' : '.jpg'
  const filePath = join(tempDir, `${paddedPrefix}-${name}${ext}`)
  await writeFile(filePath, buffer)
}

/**
 * Saves JSON data to temp directory with numbered prefix.
 * Input: temp dir, prefix number, name, data
 * Output: void
 */
async function saveJsonToTemp(
  tempDir: string,
  prefix: number,
  name: string,
  data: unknown
): Promise<void> {
  const paddedPrefix = String(prefix).padStart(2, '0')
  const filePath = join(tempDir, `${paddedPrefix}-${name}.json`)
  const content = JSON.stringify(data, null, 2)
  await writeFile(filePath, content, 'utf-8')
}

describe('Tiling OCR End-to-End', () => {
  const skipTests = !API_KEY

  if (skipTests) {
    it.skip(`SKIPPED: ${SKIP_REASON}`, () => {})
    return
  }

  let tempDir: string
  let imageBuffer: Buffer

  beforeAll(async () => {
    tempDir = await createTempDir()
    console.log(`Test artifacts will be saved to: ${tempDir}`)
    imageBuffer = await readFile(
      join(TEST_DATA_DIR, 'stitched-1767655420318.png')
    )
  })

  it('processes stitched image through full tiling OCR pipeline', async () => {
    // Step 1: Save original image
    await saveBufferToTemp(tempDir, 0, 'original-image', imageBuffer)

    // Step 2: Create tiles
    const tiles = await createAdaptiveTiles(imageBuffer, {
      fileSizeThreshold: 100 * 1024 // Force tiling with 100KB threshold
    })

    expect(tiles.length).toBeGreaterThan(0)

    // Save tiles metadata
    const tilesMetadata = tiles.map((t, i) => ({
      index: i,
      startY: t.startY,
      width: t.width,
      height: t.height,
      bufferSize: t.buffer.length
    }))
    await saveJsonToTemp(tempDir, 1, 'tiles-metadata', tilesMetadata)

    // Step 3: Save each tile image
    for (let i = 0; i < tiles.length; i++) {
      await saveBufferToTemp(tempDir, 2, `tile-${i}`, tiles[i].buffer)
    }

    // Step 4: Process each tile through OCR
    const allResults: OcrResultWithContext[] = []

    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i]
      const format = detectImageFormat(tile.buffer)
      const base64Image = `data:${format.mimeType};base64,${tile.buffer.toString('base64')}`

      // Call OCR API
      const rawResponse = await callOcrSpaceApi(base64Image, {
        apiKey: API_KEY,
        language: 'kor',
        ocrEngine: '2',
        scale: true,
        isOverlayRequired: true,
        filetype: format.filetype
      })

      // Save raw OCR response
      await saveJsonToTemp(tempDir, 3, `tile-${i}-ocr-raw`, rawResponse)

      expect(rawResponse.OCRExitCode).toBe(1)

      // Parse OCR response
      const parsedResults = parseOcrResponse(rawResponse)

      // Save parsed results
      await saveJsonToTemp(tempDir, 4, `tile-${i}-ocr-parsed`, parsedResults)

      // Adjust coordinates
      const adjustedResults = adjustCoordinates(parsedResults, tile)

      // Save adjusted results
      await saveJsonToTemp(tempDir, 5, `tile-${i}-adjusted`, adjustedResults)

      allResults.push(...adjustedResults)

      // Rate limiting between tiles
      if (i < tiles.length - 1) {
        await delay(500)
      }
    }

    // Step 5: Save all results before deduplication
    await saveJsonToTemp(tempDir, 6, 'all-results-before-dedupe', allResults)

    expect(allResults.length).toBeGreaterThan(0)

    // Step 6: Deduplicate results
    const finalResults = filterDuplicates(allResults)

    // Step 7: Save final combined results
    await saveJsonToTemp(tempDir, 7, 'final-combined-results', finalResults)

    // Step 8: Verify results
    expect(Array.isArray(finalResults)).toBe(true)
    expect(finalResults.length).toBeGreaterThan(0)
    expect(finalResults.length).toBeLessThanOrEqual(allResults.length)

    // Verify structure
    for (const result of finalResults) {
      expect(result).toHaveProperty('text')
      expect(result).toHaveProperty('bbox')
      expect(typeof result.text).toBe('string')
      expect(result.text.length).toBeGreaterThan(0)
      expect(typeof result.bbox.x).toBe('number')
      expect(typeof result.bbox.y).toBe('number')
      expect(typeof result.bbox.width).toBe('number')
      expect(typeof result.bbox.height).toBe('number')
      expect(result.bbox.x).toBeGreaterThanOrEqual(0)
      expect(result.bbox.y).toBeGreaterThanOrEqual(0)
      expect(result.bbox.width).toBeGreaterThan(0)
      expect(result.bbox.height).toBeGreaterThan(0)
    }

    // Verify coordinate adjustment worked
    const tile0Results = allResults.filter(
      r => r.tileContext.y === tiles[0].startY
    )
    if (tile0Results.length > 0) {
      const firstResult = tile0Results[0]
      expect(firstResult.bbox.y).toBeGreaterThanOrEqual(tiles[0].startY)
    }

    console.log(`\nTest artifacts saved to: ${tempDir}`)
    console.log(`Tiles created: ${tiles.length}`)
    console.log(`Total OCR results before dedupe: ${allResults.length}`)
    console.log(`Final results after dedupe: ${finalResults.length}`)
  }, 120000) // Extended timeout for multiple API calls
})

