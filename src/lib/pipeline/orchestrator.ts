import { processImage } from '@/lib/pipeline/ocr'
import { groupOcrIntoLines } from '@/lib/pipeline/textGrouper'
import { extractVocabularyAndGrammar } from '@/lib/pipeline/translator'
import {
  storeChapterVocabulary,
  storeChapterGrammar,
  StoreResult,
  GrammarStoreResult
} from '@/lib/pipeline/database'
import {
  OcrConfig,
  WordExtractorConfig,
  ExtractionResult
} from '@/lib/pipeline/types'
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
 * Includes both vocabulary and grammar storage results.
 */
export type ProcessResult = {
  // From StoreResult (vocabulary)
  newWordsInserted: number
  totalWordsInChapter: number
  chapterId: string
  // From GrammarStoreResult
  newGrammarInserted: number
  totalGrammarInChapter: number
  // Pipeline metadata
  seriesSlug: string
  chapterNumber: number
  dialogueLinesCount: number
  vocabularyExtracted: number
  grammarExtracted: number
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

  let extraction: ExtractionResult
  try {
    logger.debug('Starting vocabulary and grammar extraction')
    extraction = await runExtraction(dialogue, config?.wordExtractor)
    logger.info({
      vocabularyCount: extraction.vocabulary.length,
      grammarCount: extraction.grammar.length
    }, 'Extraction completed')
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error)
    }, 'Extraction failed')
    throw new Error(
      `Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }

  if (extraction.vocabulary.length === 0 && extraction.grammar.length === 0) {
    logger.warn('No vocabulary or grammar extracted from dialogue')
    throw new Error('No vocabulary or grammar extracted from dialogue')
  }

  let vocabResult: StoreResult
  let grammarResult: GrammarStoreResult
  try {
    logger.debug('Storing vocabulary and grammar in database')

    // Store vocabulary
    vocabResult = await storeChapterVocabulary(
      extraction.vocabulary,
      seriesSlug,
      chapterNumber,
      chapterTitle,
      chapterLink
    )

    // Store grammar (reuses chapterId from vocab storage)
    grammarResult = await storeChapterGrammar(
      extraction.grammar,
      seriesSlug,
      chapterNumber,
      chapterTitle,
      chapterLink
    )

    logger.info({
      newWordsInserted: vocabResult.newWordsInserted,
      totalWordsInChapter: vocabResult.totalWordsInChapter,
      newGrammarInserted: grammarResult.newGrammarInserted,
      totalGrammarInChapter: grammarResult.totalGrammarInChapter
    }, 'Database storage completed')
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error)
    }, 'Database storage failed')
    throw new Error(
      `Database storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }

  const finalResult: ProcessResult = {
    // Vocabulary results
    newWordsInserted: vocabResult.newWordsInserted,
    totalWordsInChapter: vocabResult.totalWordsInChapter,
    chapterId: vocabResult.chapterId,
    // Grammar results
    newGrammarInserted: grammarResult.newGrammarInserted,
    totalGrammarInChapter: grammarResult.totalGrammarInChapter,
    // Metadata
    seriesSlug,
    chapterNumber,
    dialogueLinesCount: dialogueLines.length,
    vocabularyExtracted: extraction.vocabulary.length,
    grammarExtracted: extraction.grammar.length
  }

  await saveDebugJson('final-result', finalResult)

  logger.info({
    chapterId: finalResult.chapterId,
    newWordsInserted: finalResult.newWordsInserted,
    totalWordsInChapter: finalResult.totalWordsInChapter,
    newGrammarInserted: finalResult.newGrammarInserted,
    totalGrammarInChapter: finalResult.totalGrammarInChapter,
    dialogueLinesCount: finalResult.dialogueLinesCount,
    vocabularyExtracted: finalResult.vocabularyExtracted,
    grammarExtracted: finalResult.grammarExtracted
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
 * Extracts vocabulary and grammar from dialogue.
 * Input: dialogue text, optional config
 * Output: ExtractionResult with vocabulary and grammar arrays
 */
async function runExtraction(
  dialogue: string,
  config?: Partial<WordExtractorConfig>
): Promise<ExtractionResult> {
  const extractorConfig: WordExtractorConfig = {
    apiKey: process.env.GEMINI_API_KEY || '',
    ...config
  }

  if (!extractorConfig.apiKey) {
    logger.error('GEMINI_API_KEY not configured')
    throw new Error('GEMINI_API_KEY not configured')
  }

  logger.debug({
    dialogueLength: dialogue.length,
    model: extractorConfig.model
  }, 'Running vocabulary and grammar extraction')
  return extractVocabularyAndGrammar(dialogue, extractorConfig)
}
