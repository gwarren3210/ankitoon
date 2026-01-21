/**
 * Rectangle bounding box in image coordinates.
 */
export type BoundingBox = {
  x: number
  y: number
  width: number
  height: number
}

/**
 * OCR result for a single text region.
 */
export type OcrResult = {
  text: string
  bbox: BoundingBox
}

/**
 * OCR result with tile context for deduplication.
 */
export type OcrResultWithContext = OcrResult & {
  tileContext: BoundingBox
}

/**
 * Configuration for tiling behavior.
 */
export type TilingConfig = {
  /** File size threshold in bytes (default: 1MB) */
  fileSizeThreshold: number
  /** Overlap percentage for tiles (default: 0.10 = 10%) */
  overlapPercentage: number
}

/**
 * Configuration for image upscaling.
 */
export type UpscaleConfig = {
  /** Scale factor (default: 2.0) */
  scale?: number
  /** Enable upscaling (default: false) */
  enabled?: boolean
}

/**
 * Configuration for OCR processing.
 */
export type OcrConfig = {
  /** OCR.space API key */
  apiKey: string
  /** OCR language (default: 'kor') */
  language: string
  /** OCR engine 1 or 2 (default: 2) */
  ocrEngine: 1 | 2
  /** Scale images (default: true) */
  scale: boolean
  /** Upscale configuration */
  upscale?: UpscaleConfig
  /** Max retries for rate limit errors (default: 3) */
  maxRetries?: number
  /** Initial backoff delay in ms (default: 1000) */
  initialBackoffMs?: number
  /** Max backoff delay in ms (default: 30000) */
  maxBackoffMs?: number
  /** Max concurrent OCR requests per batch (default: 20) */
  batchSize?: number
} & TilingConfig

/**
 * Tile with position metadata.
 */
export type TileInfo = {
  buffer: Buffer
  startY: number
  width: number
  height: number
}

/**
 * Tile metadata for serialization (without buffer).
 */
export type TileMetadata = {
  index?: number
  startY: number
  width: number
  height: number
  bufferSize: number
}

/**
 * Tiles info structure saved to JSON files.
 */
export type TilesInfo = {
  tileCount: number
  tiles: TileMetadata[]
  sourceImage?: string
}

/**
 * Grouped OCR line with combined bounding box.
 */
export type OcrLineResult = {
  line: string
  bbox: BoundingBox
}

/**
 * Extracted vocabulary word with translation.
 * sense_key disambiguates homonyms (same term, different meanings).
 */
export type ExtractedWord = {
  korean: string
  english: string
  importanceScore: number
  senseKey: string
  chapterExample: string
  globalExample: string
}

/**
 * Extracted grammar pattern with translation.
 * sense_key disambiguates patterns with same form but different meanings.
 * Structure is identical to ExtractedWord for consistency.
 */
export type ExtractedGrammar = {
  korean: string
  english: string
  importanceScore: number
  senseKey: string
  chapterExample: string
  globalExample: string
}

/**
 * Combined extraction result from Gemini API.
 * Contains both vocabulary words and grammar patterns.
 */
export type ExtractionResult = {
  vocabulary: ExtractedWord[]
  grammar: ExtractedGrammar[]
}

/**
 * Configuration for word extraction.
 */
export type WordExtractorConfig = {
  /** Gemini API key */
  apiKey: string
  /** Model to use (default: 'gemini-2.5-flash') */
  model?: string
}

