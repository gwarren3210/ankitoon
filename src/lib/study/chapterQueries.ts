import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * Result of chapter validation and card count query.
 * Input: N/A (type definition)
 * Output: chapter data with card counts
 */
export interface ChapterValidationResult {
  chapter: { id: string; series_id: string }
  existingCardsCount: number
  totalCardsCount: number
}

/**
 * Error types for chapter validation
 */
export type ChapterValidationError =
  | { type: 'chapter_not_found' }
  | { type: 'no_vocabulary' }
  | { type: 'query_error'; message: string }

/**
 * Validates chapter exists and gets card counts in batched queries.
 * Combines multiple sequential queries into parallel operations.
 * Input: user id, chapter id, deck id
 * Output: ChapterValidationResult or ChapterValidationError
 */
export async function validateChapterAndGetCounts(
  userId: string,
  chapterId: string,
  deckId: string
): Promise<
  | { success: true; data: ChapterValidationResult }
  | { success: false; error: ChapterValidationError }
> {
  const supabase = await createClient()
  logger.debug(
    { userId, chapterId, deckId },
    'Validating chapter and getting card counts'
  )

  // Execute all queries in parallel for efficiency
  const [chapterResult, existingCardsResult, totalCardsResult] =
    await Promise.all([
      supabase
        .from('chapters')
        .select('id, series_id')
        .eq('id', chapterId)
        .single(),
      supabase
        .from('user_deck_srs_cards')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('deck_id', deckId),
      supabase
        .from('chapter_vocabulary')
        .select('id', { count: 'exact', head: true })
        .eq('chapter_id', chapterId)
    ])

  // Check for chapter existence
  if (chapterResult.error || !chapterResult.data) {
    logger.warn(
      {
        userId,
        chapterId,
        error: chapterResult.error?.message,
        code: chapterResult.error?.code
      },
      'Chapter not found'
    )
    return { success: false, error: { type: 'chapter_not_found' } }
  }

  // Check for query errors
  if (existingCardsResult.error) {
    logger.error(
      {
        userId,
        chapterId,
        deckId,
        error: existingCardsResult.error.message,
        code: existingCardsResult.error.code
      },
      'Error checking existing cards'
    )
    return {
      success: false,
      error: {
        type: 'query_error',
        message: 'Failed to check existing cards'
      }
    }
  }

  if (totalCardsResult.error) {
    logger.error(
      {
        userId,
        chapterId,
        error: totalCardsResult.error.message,
        code: totalCardsResult.error.code
      },
      'Error checking total cards'
    )
    return {
      success: false,
      error: {
        type: 'query_error',
        message: 'Failed to check total cards'
      }
    }
  }

  const totalCardsCount = totalCardsResult.count ?? 0
  if (totalCardsCount === 0) {
    logger.warn({ userId, chapterId, deckId }, 'Chapter has no vocabulary')
    return { success: false, error: { type: 'no_vocabulary' } }
  }

  logger.debug(
    {
      userId,
      chapterId,
      deckId,
      existingCardsCount: existingCardsResult.count ?? 0,
      totalCardsCount
    },
    'Chapter validation successful'
  )

  return {
    success: true,
    data: {
      chapter: chapterResult.data,
      existingCardsCount: existingCardsResult.count ?? 0,
      totalCardsCount
    }
  }
}

/**
 * Gets series_id for a chapter.
 * Input: chapter id
 * Output: series_id or null
 */
export async function getChapterSeriesId(
  chapterId: string
): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('chapters')
    .select('series_id')
    .eq('id', chapterId)
    .single()

  if (error) {
    logger.error(
      { chapterId, error: error.message, code: error.code },
      'Error fetching chapter series_id'
    )
    return null
  }

  return data?.series_id ?? null
}
