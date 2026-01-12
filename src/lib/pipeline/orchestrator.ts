import { processImage } from '@/lib/pipeline/ocr'
import { groupOcrIntoLines } from '@/lib/pipeline/textGrouper'
import { extractWords } from '@/lib/pipeline/translator'
import { storeChapterVocabulary, StoreResult } from '@/lib/pipeline/database'
import { OcrConfig, WordExtractorConfig } from '@/lib/pipeline/types'
import {
  initDebugArtifacts,
  resetDebugArtifacts,
  saveDebugImage,
  saveDebugText,
  saveDebugJson
} from '@/lib/pipeline/debugArtifacts'
import { logger } from '@/lib/logger'

/**
 * Configuration for the full pipeline.
 */
export type PipelineConfig = {
  ocr?: Partial<OcrConfig>
  wordExtractor?: Partial<WordExtractorConfig>
  /** Vertical threshold for grouping OCR results (default: 100px) */
  groupingThreshold?: number
}

/**
 * Result of processing an image through the full pipeline.
 */
export type ProcessResult = StoreResult & {
  seriesSlug: string
  chapterNumber: number
  dialogueLinesCount: number
  wordsExtracted: number
}

/**
 * Processes image through OCR, grouping, extraction, and database storage.
 * Input: image buffer, series slug, chapter number, title, config, external url
 * Output: process result with counts and chapter id
 */
export async function processImageToDatabase(
  imageBuffer: Buffer,
  seriesSlug: string,
  chapterNumber: number,
  chapterTitle?: string,
  config?: PipelineConfig,
  chapterLink?: string
): Promise<ProcessResult> {
  logger.info({
    seriesSlug,
    chapterNumber,
    chapterTitle,
    chapterLink,
    imageSize: imageBuffer.length
  }, 'Pipeline started')

  resetDebugArtifacts()
  await initDebugArtifacts()
  await saveDebugImage('original-image', imageBuffer)

  let ocrResults: Awaited<ReturnType<typeof processImage>>
  try {
    logger.debug('Starting OCR processing')
    ocrResults = await runOcr(imageBuffer, config?.ocr)
    logger.info({ resultCount: ocrResults.length }, 'OCR completed')
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'OCR failed')
    throw new Error(`OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  if (ocrResults.length === 0) {
    logger.warn('No text detected in image')
    throw new Error('No text detected in image')
  }

  logger.debug({ threshold: config?.groupingThreshold }, 'Grouping dialogue')
  const dialogueLines = await groupDialogue(ocrResults, config?.groupingThreshold)
  const dialogue = combineDialogue(dialogueLines)
  await saveDebugText('dialogue-combined', dialogue)
  logger.info({ lineCount: dialogueLines.length, dialogueLength: dialogue.length }, 'Dialogue grouped')

  if (!dialogue || dialogue.trim().length === 0) {
    logger.warn('No dialogue extracted from OCR results')
    throw new Error('No dialogue extracted from OCR results')
  }

  let words: Awaited<ReturnType<typeof extractWords>>
  try {
    logger.debug('Starting word extraction')
    words = await runExtraction(dialogue, config?.wordExtractor)
    logger.info({ wordCount: words.length }, 'Word extraction completed')
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Word extraction failed')
    throw new Error(`Word extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  if (words.length === 0) {
    logger.warn('No vocabulary words extracted from dialogue')
    throw new Error('No vocabulary words extracted from dialogue')
  }

  let storeResult: StoreResult
  try {
    logger.debug('Storing vocabulary in database')
    storeResult = await storeChapterVocabulary(
      words,
      seriesSlug,
      chapterNumber,
      chapterTitle,
      chapterLink
    )
    logger.info({
      newWordsInserted: storeResult.newWordsInserted,
      totalWordsInChapter: storeResult.totalWordsInChapter
    }, 'Database storage completed')
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Database storage failed')
    throw new Error(`Database storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  const finalResult = {
    ...storeResult,
    seriesSlug,
    chapterNumber,
    dialogueLinesCount: dialogueLines.length,
    wordsExtracted: words.length
  }

  await saveDebugJson('final-result', finalResult)

  logger.info({
    chapterId: finalResult.chapterId,
    newWordsInserted: finalResult.newWordsInserted,
    totalWordsInChapter: finalResult.totalWordsInChapter,
    dialogueLinesCount: finalResult.dialogueLinesCount,
    wordsExtracted: finalResult.wordsExtracted
  }, 'Pipeline completed successfully')

  return finalResult
}

/**
 * Runs OCR on image buffer.
 * Input: image buffer, optional config
 * Output: OCR results array
 */
async function runOcr(
  imageBuffer: Buffer,
  config?: Partial<OcrConfig>
) {
  const ocrConfig: Partial<OcrConfig> = {
    apiKey: process.env.OCR_API_KEY,
    ...config
  }

  if (!ocrConfig.apiKey) {
    logger.error('OCR_API_KEY not configured')
    throw new Error('OCR_API_KEY not configured')
  }

  logger.debug({ imageSize: imageBuffer.length, ocrEngine: ocrConfig.ocrEngine }, 'Running OCR')
  return processImage(imageBuffer, ocrConfig)
}

/**
 * Groups OCR results into dialogue lines.
 * Input: OCR results, optional threshold
 * Output: grouped line results
 */
async function groupDialogue(
  ocrResults: Awaited<ReturnType<typeof processImage>>,
  threshold?: number
) {
  return groupOcrIntoLines(ocrResults, threshold)
}

/**
 * Combines dialogue lines into single text block.
 * Input: line results array
 * Output: combined dialogue string
 */
function combineDialogue(
  lines: Awaited<ReturnType<typeof groupOcrIntoLines>>
): string {
  return lines.map(l => l.line).join('\n')
}

/**
 * Extracts vocabulary words from dialogue.
 * Input: dialogue text, optional config
 * Output: extracted words array
 */
async function runExtraction(
  dialogue: string,
  config?: Partial<WordExtractorConfig>
) {
  const extractorConfig: WordExtractorConfig = {
    apiKey: process.env.GEMINI_API_KEY || '',
    ...config
  }

  if (!extractorConfig.apiKey) {
    logger.error('GEMINI_API_KEY not configured')
    throw new Error('GEMINI_API_KEY not configured')
  }

  logger.debug({ dialogueLength: dialogue.length, model: extractorConfig.model }, 'Running word extraction')
  return extractWords(dialogue, extractorConfig)
}
