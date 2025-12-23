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
 * Grouped OCR line with combined bounding box.
 */
export type OcrLineResult = {
  line: string
  bbox: BoundingBox
}

/**
 * Extracted vocabulary word with translation.
 */
export type ExtractedWord = {
  korean: string
  english: string
  importanceScore: number
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

