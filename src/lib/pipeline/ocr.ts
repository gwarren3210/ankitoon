import { ocrSpace } from 'ocr-space-api-wrapper'
import { promises as fs } from 'fs'
import { randomUUID } from 'crypto'
import * as os from 'os'
import * as path from 'path'
import {
  OcrResult,
  OcrResultWithContext,
  OcrConfig,
  TileInfo,
  BoundingBox
} from '@/lib/pipeline/types'
import {
  createAdaptiveTiles,
  adjustCoordinates,
  filterDuplicates,
  needsTiling
} from '@/lib/pipeline/tiling'

const DEFAULT_CONFIG: OcrConfig = {
  apiKey: process.env.OCR_API_KEY || '',
  language: 'kor',
  ocrEngine: 2,
  scale: true,
  fileSizeThreshold: 1 * 1024 * 1024,
  overlapPercentage: 0.10
}

/**
 * Processes an image buffer through OCR, automatically tiling if needed.
 * Input: image buffer and optional config
 * Output: array of OCR results with text and bounding boxes
 */
export async function processImage(
  imageBuffer: Buffer,
  config: Partial<OcrConfig> = {}
): Promise<OcrResult[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  if (!cfg.apiKey) {
    throw new Error('OCR_API_KEY not configured')
  }

  if (needsTiling(imageBuffer, cfg.fileSizeThreshold)) {
    return processWithTiling(imageBuffer, cfg)
  }

  return processSingleImage(imageBuffer, cfg)
}

/**
 * Processes a single image (no tiling needed).
 * Input: image buffer and config
 * Output: array of OCR results
 */
async function processSingleImage(
  imageBuffer: Buffer,
  config: OcrConfig
): Promise<OcrResult[]> {
  const tempPath = await saveToTemp(imageBuffer)

  try {
    const result = await callOcrApi(tempPath, config)
    return parseOcrResponse(result)
  } finally {
    await cleanupTemp(tempPath)
  }
}

/**
 * Processes a large image by splitting into tiles.
 * Input: image buffer and config
 * Output: merged and deduplicated OCR results
 */
async function processWithTiling(
  imageBuffer: Buffer,
  config: OcrConfig
): Promise<OcrResult[]> {
  const tiles = await createAdaptiveTiles(imageBuffer, config)
  const allResults: OcrResultWithContext[] = []

  for (const tile of tiles) {
    const tempPath = await saveToTemp(tile.buffer)

    try {
      const result = await callOcrApi(tempPath, config)
      const tileResults = parseOcrResponse(result)
      const adjusted = adjustCoordinates(tileResults, tile)
      allResults.push(...adjusted)

      // Rate limiting between tiles
      await delay(500)
    } catch (error) {
      console.error(`Tile OCR failed at startY=${tile.startY}:`, error)
    } finally {
      await cleanupTemp(tempPath)
    }
  }

  if (allResults.length === 0) {
    throw new Error('No tiles processed successfully')
  }

  return filterDuplicates(allResults)
}

/**
 * Calls the OCR.space API with a file path.
 * Input: file path and config
 * Output: raw API response
 */
async function callOcrApi(
  filePath: string,
  config: OcrConfig
): Promise<any> {
  const result = await ocrSpace(filePath, {
    apiKey: config.apiKey,
    language: config.language as any,
    OCREngine: config.ocrEngine === 1 ? '1' : '2',
    scale: config.scale,
    isTable: false,
    isOverlayRequired: true
  })

  if (!result) {
    throw new Error('OCR API returned no response')
  }

  if (result.OCRExitCode !== 1) {
    throw new Error(`OCR failed: ${result.ErrorMessage || 'Unknown error'}`)
  }

  return result
}

/**
 * Parses OCR.space API response into structured results.
 * Input: raw API response
 * Output: array of OCR results with bounding boxes
 */
function parseOcrResponse(ocrResult: any): OcrResult[] {
  const results: OcrResult[] = []

  if (!ocrResult.ParsedResults?.length) {
    return results
  }

  for (const parsed of ocrResult.ParsedResults) {
    const lines = parsed.TextOverlay?.Lines || []

    for (const line of lines) {
      for (const word of line.Words) {
        results.push({
          text: word.WordText,
          bbox: {
            x: word.Left,
            y: word.Top,
            width: word.Width,
            height: word.Height
          }
        })
      }
    }
  }

  return results
}

/**
 * Saves a buffer to a temporary file for API upload.
 * Input: image buffer
 * Output: temporary file path
 */
async function saveToTemp(buffer: Buffer): Promise<string> {
  const tempDir = os.tmpdir()
  const tempPath = path.join(tempDir, `ocr_${randomUUID()}.jpg`)
  await fs.writeFile(tempPath, buffer)
  return tempPath
}

/**
 * Cleans up a temporary file.
 * Input: file path
 * Output: void
 */
async function cleanupTemp(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath)
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Simple delay utility for rate limiting.
 * Input: milliseconds
 * Output: promise that resolves after delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

