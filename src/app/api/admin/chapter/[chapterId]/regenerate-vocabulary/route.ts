import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { extractVocabularyAndGrammar } from '@/lib/pipeline/translator'
import {
  storeChapterVocabulary,
  storeChapterGrammar,
  getChapterDialogue
} from '@/lib/pipeline/database'
import { logger } from '@/lib/logger'
import {
  withErrorHandler,
  requireAdmin,
  successResponse,
  BadRequestError,
  NotFoundError
} from '@/lib/api'

/**
 * Response for vocabulary regeneration.
 */
interface RegenerateResponse {
  chapterId: string
  vocabularyExtracted: number
  grammarExtracted: number
  newWordsInserted: number
  newGrammarInserted: number
}

/**
 * Gets chapter details needed for vocabulary storage.
 * Input: chapter ID
 * Output: series slug, chapter number, title
 */
async function getChapterDetails(chapterId: string): Promise<{
  seriesSlug: string
  chapterNumber: number
  chapterTitle: string | null
}> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('chapters')
    .select(`
      chapter_number,
      title,
      series:series_id (
        slug
      )
    `)
    .eq('id', chapterId)
    .single()

  if (error || !data) {
    throw new NotFoundError(`Chapter not found: ${chapterId}`)
  }

  // Supabase returns the relation as an object, but TS types it as array
  // Cast to unknown first to handle the type mismatch
  const series = data.series as unknown as { slug: string } | null
  if (!series?.slug) {
    throw new NotFoundError(`Series not found for chapter: ${chapterId}`)
  }

  return {
    seriesSlug: series.slug,
    chapterNumber: data.chapter_number,
    chapterTitle: data.title
  }
}

/**
 * POST /api/admin/chapter/[chapterId]/regenerate-vocabulary
 * Re-runs Gemini extraction using stored dialogue.
 * Requires admin role. Does not re-run OCR.
 * Input: chapterId from URL path
 * Output: RegenerateResponse with extraction counts
 */
async function handler(
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) {
  await requireAdmin()

  const params = await context?.params
  const chapterId = params?.chapterId

  if (!chapterId) {
    throw new BadRequestError('chapterId is required')
  }

  logger.info({ chapterId }, 'Regenerating vocabulary from stored dialogue')

  // Get stored dialogue
  const dialogue = await getChapterDialogue(chapterId)

  if (!dialogue) {
    throw new BadRequestError(
      'No stored dialogue found for this chapter. ' +
      'Only chapters processed after dialogue storage was enabled can ' +
      'be regenerated.'
    )
  }

  // Get chapter details for storage
  const { seriesSlug, chapterNumber, chapterTitle } = await getChapterDetails(
    chapterId
  )

  // Extract vocabulary and grammar via Gemini
  const extraction = await extractVocabularyAndGrammar(dialogue, {
    apiKey: process.env.GEMINI_API_KEY || ''
  })

  logger.info({
    chapterId,
    vocabularyCount: extraction.vocabulary.length,
    grammarCount: extraction.grammar.length
  }, 'Extraction completed')

  // Store vocabulary
  const vocabResult = await storeChapterVocabulary(
    extraction.vocabulary,
    seriesSlug,
    chapterNumber,
    chapterTitle || undefined
  )

  // Store grammar
  const grammarResult = await storeChapterGrammar(
    extraction.grammar,
    seriesSlug,
    chapterNumber,
    chapterTitle || undefined
  )

  const response: RegenerateResponse = {
    chapterId,
    vocabularyExtracted: extraction.vocabulary.length,
    grammarExtracted: extraction.grammar.length,
    newWordsInserted: vocabResult.newWordsInserted,
    newGrammarInserted: grammarResult.newGrammarInserted
  }

  logger.info(response, 'Vocabulary regeneration completed')

  return successResponse(response)
}

export const POST = withErrorHandler(handler)
