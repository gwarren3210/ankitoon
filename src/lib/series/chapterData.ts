import { createClient } from '@/lib/supabase/server'
import { Tables } from '@/types/database.types'
import { ChapterVocabulary } from '@/types/series.types'
import { logger } from '@/lib/logger'
import {
  fetchSeriesWithChapters,
  sortChaptersByNumber,
  findAdjacentChapters,
  fetchChapterData
} from '@/lib/series/chapterHelpers'

/**
 * Gets chapter by series ID and chapter number.
 * Input: series id, chapter number
 * Output: Chapter data or null
 */
export async function getChapterByNumber(
  seriesId: string,
  chapterNumber: number
): Promise<Tables<'chapters'> | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('series_id', seriesId)
    .eq('chapter_number', chapterNumber)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null
    }
    throw error
  }

  return data
}

/**
 * Gets all chapter page data in optimized queries.
 * Input: series slug, chapter number, optional user id
 * Output: Combined chapter page data
 */
export async function getChapterPageData(
  slug: string,
  chapterNumber: number,
  userId?: string
): Promise<{
  series: (Tables<'series'> & { num_chapters: number }) | null
  chapter: Tables<'chapters'> | null
  prevChapter: Tables<'chapters'> | null
  nextChapter: Tables<'chapters'> | null
  vocabulary: ChapterVocabulary[]
  chapterProgress: Tables<'user_chapter_progress_summary'> | null
}> {
  const startTime = Date.now()
  logger.debug({ slug, chapterNumber, userId: userId ? 'present' : 'absent' }, 'Fetching chapter page data')

  try {
    const seriesData = await fetchSeriesWithChapters(slug)
    if (!seriesData) {
      logger.warn({ slug }, 'Series not found')
      return {
        series: null,
        chapter: null,
        prevChapter: null,
        nextChapter: null,
        vocabulary: [],
        chapterProgress: null
      }
    }

    const { series, allChapters } = seriesData
    const sortedChapters = sortChaptersByNumber(allChapters)
    const { chapter, prevChapter, nextChapter } = findAdjacentChapters(sortedChapters, chapterNumber)

    if (!chapter) {
      logger.warn({ slug, chapterNumber }, 'Chapter not found in series')
      return {
        series,
        chapter: null,
        prevChapter,
        nextChapter,
        vocabulary: [],
        chapterProgress: null
      }
    }

    const { vocabulary, chapterProgress } = await fetchChapterData(chapter.id, userId)

    const duration = Date.now() - startTime
    logger.info(
      {
        slug,
        chapterNumber,
        seriesId: series.id,
        chapterId: chapter.id,
        vocabularyCount: vocabulary.length,
        hasProgress: !!chapterProgress,
        durationMs: duration
      },
      'Chapter page data fetched successfully'
    )

    return {
      series,
      chapter,
      prevChapter,
      nextChapter,
      vocabulary,
      chapterProgress
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCause = error instanceof Error ? error.cause : undefined
    const duration = Date.now() - startTime
    logger.error(
      {
        slug,
        chapterNumber,
        error: errorMessage,
        cause: errorCause,
        durationMs: duration
      },
      'Failed to fetch chapter page data'
    )
    throw error
  }
}
