import { promises as fs } from 'fs'
import { randomUUID } from 'crypto'
import * as os from 'os'
import * as path from 'path'
import {
  OcrResult,
  OcrResultWithContext,
  OcrConfig
} from '@/lib/pipeline/types'
import {
  createAdaptiveTiles,
  adjustCoordinates,
  filterDuplicates,
  needsTiling
} from '@/lib/pipeline/tiling'
import { saveDebugImage, saveDebugJson } from '@/lib/pipeline/debugArtifacts'
import { logger } from '@/lib/pipeline/logger'
import { upscaleImage } from '@/lib/pipeline/upscale'

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
 * Processes a large image by splitting into tiles.
 * Input: image buffer and config
 * Output: merged and deduplicated OCR results
 */
async function processWithTiling(
  imageBuffer: Buffer,
  config: OcrConfig
): Promise<OcrResult[]> {
  const tiles = await createAdaptiveTiles(imageBuffer, config)
  logger.info({ tileCount: tiles.length, ocrEngine: config.ocrEngine }, 'Created tiles for processing')

  const tilesMetadata = tiles.map((t, i) => ({
    index: i,
    startY: t.startY,
    width: t.width,
    height: t.height,
    bufferSize: t.buffer.length
  }))
  await saveDebugJson('tiles-metadata', tilesMetadata)

  const allResults: OcrResultWithContext[] = []

  for (let i = 0; i < tiles.length; i++) {
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
      const result = await callOcrApi(tempPath, tileConfig)
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
      allResults.push(...adjusted)
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

      // Rate limiting between tiles
      await delay(500)
    } catch (error) {
      logger.error({
        tileIndex: i,
        startY: tile.startY,
        error: error instanceof Error ? error.message : String(error)
      }, 'Tile OCR failed')
    } finally {
      await cleanupTemp(tempPath)
    }
  }

  if (allResults.length === 0) {
    logger.error('No tiles processed successfully')
    throw new Error('No tiles processed successfully')
  }

  logger.debug({ totalResults: allResults.length }, 'Deduplicating tile results')
  const deduplicated = filterDuplicates(allResults)
  await saveDebugJson('ocr-combined', deduplicated)
  logger.info({ resultCount: deduplicated.length }, 'Tiled OCR processing completed')
  return deduplicated
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
  const base64Image = `data:image/jpeg;base64,${buffer.toString('base64')}`

  const options: OcrSpaceOptions = {
    apiKey: config.apiKey,
    language: config.language,
    ocrEngine: config.ocrEngine === 1 ? '1' : '2',
    scale: config.scale,
    isOverlayRequired: true,
    filetype: 'JPG'
  }

  logger.debug({
    filePath,
    ocrEngine: config.ocrEngine,
    bufferSize: buffer.length,
    language: config.language
  }, 'Calling OCR API')

  const result = await callOcrSpaceApi(base64Image, options)

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
function parseOcrResponse(ocrResult: OcrSpaceResponse): OcrResult[] {
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

