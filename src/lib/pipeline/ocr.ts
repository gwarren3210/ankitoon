import { promises as fs } from 'fs'
import { randomUUID } from 'crypto'
import * as os from 'os'
import * as path from 'path'
import {
  OcrResult,
  OcrResultWithContext,
  OcrConfig,
  TileInfo
} from '@/lib/pipeline/types'
import {
  createAdaptiveTiles,
  adjustCoordinates,
  filterDuplicates,
  needsTiling
} from '@/lib/pipeline/tiling'
import { saveDebugImage, saveDebugJson } from '@/lib/pipeline/debugArtifacts'
import { logger } from '@/lib/logger'
import { upscaleImage } from '@/lib/pipeline/upscale'
import { RateLimitError } from '@/lib/api'

// Re-export for backward compatibility with existing consumers
export { RateLimitError }

const OCR_SPACE_API_URL = 'https://api.ocr.space/parse/image'

interface OcrSpaceOptions {
  apiKey: string
  language: string
  ocrEngine: '1' | '2'
  scale: boolean
  isOverlayRequired: boolean
  filetype?: string
}

interface OcrSpaceResponse {
  OCRExitCode: number
  ErrorMessage?: string
  ParsedResults?: Array<{
    TextOverlay?: {
      Lines?: Array<{
        Words: Array<{
          WordText: string
          Left: number
          Top: number
          Width: number
          Height: number
        }>
      }>
    }
  }>
}

const DEFAULT_CONFIG: OcrConfig = {
  apiKey: process.env.OCR_API_KEY || '',
  language: 'kor',
  ocrEngine: 2,
  scale: false, // Disabled to prevent exceeding 5000px×5000px OCR.space limit
  fileSizeThreshold: 1 * 1024 * 1024,
  overlapPercentage: 0.10
}

// Batch processing constants
const DEFAULT_BATCH_SIZE = 30
const MAX_BATCH_ITERATIONS = 10
const MAX_CONSECUTIVE_FAILURES = 2

/**
 * Result from processing a single tile.
 */
type TileProcessResult = {
  success: boolean
  tileIndex: number
  results: OcrResultWithContext[]
}

// TODO: Implement smart upscaling based on image dimensions
// Once pixel limit tests (ocr.pixelLimits.test.ts) determine safe thresholds:
// - Enable scale=true for small images (e.g., < 2400px width/height)
// - Keep scale=false for large images (approaching 5000px limit)
// OCR.space Engine 2 limit: 5000px width × 5000px height
// Estimated upscaling factor: ~2x (so 2400px → 4800px safe)

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
  logger.debug({
    imageSize: imageBuffer.length,
    fileSizeThreshold: cfg.fileSizeThreshold,
    ocrEngine: cfg.ocrEngine
  }, 'Processing image with OCR')

  if (!cfg.apiKey) {
    logger.error('OCR_API_KEY not configured')
    throw new Error('OCR_API_KEY not configured')
  }

  // Upscale image before processing if enabled
  const processedBuffer = await upscaleImage(imageBuffer, cfg.upscale)
  const wasUpscaled = processedBuffer !== imageBuffer
  if (wasUpscaled) {
    logger.info({
      originalSize: imageBuffer.length,
      upscaledSize: processedBuffer.length
    }, 'Image upscaled before OCR processing')
    await saveDebugImage('upscaled-image', processedBuffer)
  }

  if (needsTiling(processedBuffer, cfg.fileSizeThreshold)) {
    logger.info('Image requires tiling')
    return processWithTiling(processedBuffer, cfg)
  }

  logger.debug('Processing single image without tiling')
  return processSingleImage(processedBuffer, cfg)
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
  logger.debug({ tempPath }, 'Saved image to temp file')

  try {
    logger.debug('Calling OCR API for single image')
    const result = await callOcrApi(tempPath, config)
    await saveDebugJson('ocr-raw', result)
    const parsed = parseOcrResponse(result)
    await saveDebugJson('ocr-combined', parsed)
    logger.info({ resultCount: parsed.length }, 'Single image OCR completed')
    return parsed
  } finally {
    await cleanupTemp(tempPath)
    logger.debug({ tempPath }, 'Cleaned up temp file')
  }
}

/**
 * Processes a large image by splitting into tiles with batch processing.
 * Input: image buffer and config
 * Output: merged and deduplicated OCR results
 */
async function processWithTiling(
  imageBuffer: Buffer,
  config: OcrConfig
): Promise<OcrResult[]> {
  const tiles = await createAdaptiveTiles(imageBuffer, config)
  const batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE
  logger.info({
    tileCount: tiles.length,
    batchSize,
    ocrEngine: config.ocrEngine
  }, 'Created tiles for batch processing')

  const tilesMetadata = tiles.map((t, i) => ({
    index: i,
    startY: t.startY,
    width: t.width,
    height: t.height,
    bufferSize: t.buffer.length
  }))
  await saveDebugJson('tiles-metadata', tilesMetadata)

  // Track pending tile indices and results
  let pendingIndices = tiles.map((_, i) => i)
  const allResults: OcrResultWithContext[] = []
  let batchIteration = 0
  let consecutiveFailures = 0

  while (
    pendingIndices.length > 0 &&
    batchIteration < MAX_BATCH_ITERATIONS
  ) {
    // Take next batch of tiles
    const batchIndices = pendingIndices.slice(0, batchSize)
    pendingIndices = pendingIndices.slice(batchSize)

    // Process batch in parallel
    const batchResults = await processTileBatch(tiles, batchIndices, config)

    // Separate successes and failures
    let batchSuccessCount = 0
    for (const result of batchResults) {
      if (result.success) {
        allResults.push(...result.results)
        batchSuccessCount++
      } else {
        // Add failed tile to end of pending queue for retry
        pendingIndices.push(result.tileIndex)
      }
    }

    // Track consecutive failures
    if (batchSuccessCount === 0) {
      consecutiveFailures++
      logger.warn({
        batch: batchIteration + 1,
        consecutiveFailures
      }, 'Batch had zero successful OCR results')

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        logger.error({
          consecutiveFailures,
          remainingTiles: pendingIndices.length
        }, 'Stopping: consecutive batches failed completely')
        break
      }
    } else {
      consecutiveFailures = 0
    }

    batchIteration++
    logger.info({
      batch: batchIteration,
      successCount: batchSuccessCount,
      failureCount: batchIndices.length - batchSuccessCount,
      remaining: pendingIndices.length
    }, 'Batch completed')
  }

  if (pendingIndices.length > 0) {
    logger.warn({
      unprocessedTiles: pendingIndices.length
    }, 'Some tiles failed after max retries')
  }

  if (allResults.length === 0) {
    logger.error('No tiles processed successfully')
    throw new Error('No tiles processed successfully')
  }

  logger.debug({ totalResults: allResults.length }, 'Deduplicating tile results')
  const deduplicated = filterDuplicates(allResults)
  logger.info({ resultCount: deduplicated.length }, 'Tiled OCR processing completed')
  return deduplicated
}

/**
 * Processes a batch of tiles in parallel.
 * Input: all tiles, indices to process, config
 * Output: array of tile processing results
 */
async function processTileBatch(
  tiles: TileInfo[],
  indices: number[],
  config: OcrConfig
): Promise<TileProcessResult[]> {
  const tilePromises = indices.map(async (i) => {
    const tile = tiles[i]
    await saveDebugImage(`tile-${i}`, tile.buffer)
    const tempPath = await saveToTemp(tile.buffer)
    logger.debug({
      tileIndex: i,
      startY: tile.startY,
      tileWidth: tile.width,
      tileHeight: tile.height,
      tileBufferSize: tile.buffer.length
    }, 'Processing tile')

    const tileConfig = {
      ...config,
      ocrEngine: config.ocrEngine,
      reason: 'using configured engine'
    }

    try {
      logger.debug({ tileIndex: i }, 'Calling OCR API for tile')
      const result = await retryWithBackoff(
        () => callOcrApi(tempPath, tileConfig),
        tileConfig
      )
      logger.debug({
        tileIndex: i,
        exitCode: result.OCRExitCode,
        hasParsedResults: !!result.ParsedResults,
        parsedResultsCount: result.ParsedResults?.length || 0
      }, 'OCR API response received')
      await saveDebugJson(`tile-${i}-ocr-raw`, result)
      const tileResults = parseOcrResponse(result)
      await saveDebugJson(`tile-${i}-ocr-parsed`, tileResults)
      const adjusted = adjustCoordinates(tileResults, tile)

      if (tileResults.length === 0) {
        logger.warn({
          tileIndex: i,
          startY: tile.startY,
          engineUsed: tileConfig.ocrEngine
        }, 'Tile OCR returned zero results')
      }

      logger.info({
        tileIndex: i,
        resultCount: tileResults.length,
        engineUsed: tileConfig.ocrEngine
      }, 'Tile OCR completed successfully')

      return {
        success: true,
        tileIndex: i,
        results: adjusted
      }
    } catch (error) {
      logger.error({
        tileIndex: i,
        startY: tile.startY,
        error: error instanceof Error ? error.message : String(error)
      }, 'Tile OCR failed')
      return {
        success: false,
        tileIndex: i,
        results: []
      }
    } finally {
      await cleanupTemp(tempPath)
    }
  })

  const settledResults = await Promise.allSettled(tilePromises)
  const results: TileProcessResult[] = []

  for (const settled of settledResults) {
    if (settled.status === 'fulfilled') {
      results.push(settled.value)
    } else {
      logger.error({
        error: settled.reason instanceof Error
          ? settled.reason.message
          : String(settled.reason)
      }, 'Tile promise rejected unexpectedly')
    }
  }

  return results
}

/**
 * Detects image format from buffer signature.
 * Input: image buffer
 * Output: format info with mime type and filetype
 */
export function detectImageFormat(buffer: Buffer): { mimeType: string; filetype: string } {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return { mimeType: 'image/png', filetype: 'PNG' }
  }
  // JPEG signature: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { mimeType: 'image/jpeg', filetype: 'JPG' }
  }
  // Default to JPEG if unknown
  logger.warn('Unknown image format, defaulting to JPEG')
  return { mimeType: 'image/jpeg', filetype: 'JPG' }
}

/**
 * Calls the OCR.space API with a file path using native fetch.
 * Input: file path and config
 * Output: raw API response
 */
async function callOcrApi(
  filePath: string,
  config: OcrConfig
): Promise<OcrSpaceResponse> {
  const buffer = await fs.readFile(filePath)
  const format = detectImageFormat(buffer)
  const base64Image = `data:${format.mimeType};base64,${buffer.toString('base64')}`

  const options: OcrSpaceOptions = {
    apiKey: config.apiKey,
    language: config.language,
    ocrEngine: config.ocrEngine === 1 ? '1' : '2',
    scale: config.scale,
    isOverlayRequired: true,
    filetype: format.filetype
  }

  logger.debug({
    filePath,
    ocrEngine: config.ocrEngine,
    bufferSize: buffer.length,
    language: config.language,
    detectedFormat: format.filetype,
    mimeType: format.mimeType
  }, 'Calling OCR API')

  const result = await retryWithBackoff(
    () => callOcrSpaceApi(base64Image, options),
    config
  )

  if (!result) {
    logger.error('OCR API returned no response')
    throw new Error('OCR API returned no response')
  }

  if (result.OCRExitCode !== 1) {
    logger.error({
      exitCode: result.OCRExitCode,
      errorMessage: result.ErrorMessage
    }, 'OCR API returned error')
    throw new Error(`OCR failed: ${result.ErrorMessage || 'Unknown error'}`)
  }

  logger.debug({ exitCode: result.OCRExitCode }, 'OCR API call successful')
  return result
}

/**
 * Fetch implementation for OCR.space API.
 * Input: base64 image string and options
 * Output: OCR Space API response
 */
export async function callOcrSpaceApi(
  input: string,
  options: OcrSpaceOptions
): Promise<OcrSpaceResponse> {
  const formData = new FormData()

  // Detect input type and append to formData
  if (input.startsWith('http')) {
    formData.append('url', input)
  } else if (input.startsWith('data:')) {
    formData.append('base64Image', input)
  } else {
    throw new Error('Invalid input: expected URL or base64 image')
  }

  // Append OCR options
  formData.append('language', options.language)
  formData.append('isOverlayRequired', String(options.isOverlayRequired))
  formData.append('detectOrientation', 'false')
  formData.append('isCreateSearchablePdf', 'false')
  formData.append('isSearchablePdfHideTextLayer', 'false')
  formData.append('scale', String(options.scale))
  formData.append('isTable', 'false')
  formData.append('OCREngine', options.ocrEngine)

  if (options.filetype) {
    formData.append('filetype', options.filetype)
  }

  const response = await fetch(OCR_SPACE_API_URL, {
    method: 'POST',
    headers: {
      apikey: options.apiKey
    },
    body: formData
  })

  if (response.status === 429) {
    throw new RateLimitError(`OCR API rate limit exceeded: ${response.status}`)
  }

  if (!response.ok) {
    throw new Error(`OCR API HTTP error: ${response.status}`)
  }

  return response.json()
}

/**
 * Parses OCR.space API response into structured results.
 * Input: raw API response
 * Output: array of OCR results with bounding boxes
 */
export function parseOcrResponse(ocrResult: OcrSpaceResponse): OcrResult[] {
  const results: OcrResult[] = []

  if (!ocrResult.ParsedResults?.length) {
    logger.debug({
      hasParsedResults: !!ocrResult.ParsedResults,
      parsedResultsLength: ocrResult.ParsedResults?.length || 0,
      exitCode: ocrResult.OCRExitCode,
      errorMessage: ocrResult.ErrorMessage
    }, 'OCR API returned no parsed results')
    return results
  }

  for (const parsed of ocrResult.ParsedResults) {
    const lines = parsed.TextOverlay?.Lines || []
    logger.debug({
      lineCount: lines.length,
      hasTextOverlay: !!parsed.TextOverlay
    }, 'Parsing OCR parsed result')

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

  logger.debug({
    resultCount: results.length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    totalLines: ocrResult.ParsedResults.reduce((sum: number, p: any) => sum + (p.TextOverlay?.Lines?.length || 0), 0)
  }, 'OCR response parsed')

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
  logger.debug({ tempPath, bufferSize: buffer.length }, 'Saving buffer to temp file')
  await fs.writeFile(tempPath, buffer)
  // Verify file was written correctly
  const stats = await fs.stat(tempPath)
  logger.debug({
    tempPath,
    fileSize: stats.size,
    matchesBuffer: stats.size === buffer.length
  }, 'Temp file written')
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

/**
 * Retries a function with exponential backoff on rate limit errors.
 * Input: async function, config with retry settings
 * Output: result of function or throws last error
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: OcrConfig
): Promise<T> {
  const maxRetries = config.maxRetries ?? 3
  const initialBackoffMs = config.initialBackoffMs ?? 1000
  const maxBackoffMs = config.maxBackoffMs ?? 30000

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (!(error instanceof RateLimitError)) {
        throw error
      }

      if (attempt === maxRetries) {
        logger.error({
          attempt: attempt + 1,
          maxRetries,
          error: lastError.message
        }, 'Max retries reached for rate limit')
        throw lastError
      }

      const backoffMs = Math.min(
        initialBackoffMs * Math.pow(2, attempt),
        maxBackoffMs
      )

      logger.warn({
        attempt: attempt + 1,
        maxRetries,
        backoffMs,
        error: lastError.message
      }, 'Rate limit hit, retrying with backoff')

      await delay(backoffMs)
    }
  }

  throw lastError || new Error('Retry failed')
}

