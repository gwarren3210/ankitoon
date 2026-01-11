import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Tables } from '@/types/database.types'
import { ChapterVocabulary } from '@/types/series.types'
import { logger } from '@/lib/logger'
import {
  getChapterById,
  getChapterByNumber,
  getSeriesWithChapters,
  getAdjacentChapters as getAdjacentChaptersQuery
} from '@/lib/content/queries/chapterQueries'
import {
  getSeriesBySlug,
  getSeriesById
} from '@/lib/content/queries/seriesQueries'
import {
  getChapterVocabulary as getChapterVocabularyQuery
} from '@/lib/content/queries/vocabularyQueries'
import {
  getChapterProgress
} from '@/lib/progress/queries/chapterProgressQueries'

type DbClient = SupabaseClient<Database>

/**
 * Gets complete chapter page data with series, vocabulary, and progress.
 * Input: supabase client, series slug, chapter number, optional user id
 * Output: Chapter page data with all context
 */
export async function getChapterPageData(
  supabase: DbClient,
  seriesSlug: string,
  chapterNumber: number,
  userId?: string
): Promise<{
  series: Tables<'series'> & { num_chapters: number }
  chapter: Tables<'chapters'>
  prevChapter: Tables<'chapters'> | null
  nextChapter: Tables<'chapters'> | null
  vocabulary: ChapterVocabulary[]
  chapterProgress: Tables<'user_chapter_progress_summary'> | null
} | null> {
  const startTime = Date.now()

  logger.debug({ seriesSlug, chapterNumber, userId: userId ? 'present' : 'absent' }, 'Fetching chapter page data')

  const result = await getSeriesWithChapters(supabase, seriesSlug)

  if (!result) {
    logger.debug({ seriesSlug }, 'Series not found')
    return null
  }

  const { series, chapters } = result
  const sortedChapters = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number)

  const currentChapter = sortedChapters.find(ch => ch.chapter_number === chapterNumber)

  if (!currentChapter) {
    logger.debug({ seriesSlug, chapterNumber }, 'Chapter not found')
    return null
  }

  const currentIndex = sortedChapters.findIndex(ch => ch.id === currentChapter.id)
  const prevChapter = currentIndex > 0 ? sortedChapters[currentIndex - 1] : null
  const nextChapter = currentIndex < sortedChapters.length - 1 ? sortedChapters[currentIndex + 1] : null

  const [vocabularyRows, chapterProgress] = await Promise.all([
    getChapterVocabularyQuery(supabase, currentChapter.id),
    userId ? getChapterProgress(supabase, userId, currentChapter.id) : Promise.resolve(null)
  ])

  const vocabulary = vocabularyRows.map(row => {
    const vocab = row.vocabulary
    return {
      vocabularyId: row.vocabulary_id,
      term: vocab?.term || '',
      definition: vocab?.definition || '',
      senseKey: vocab?.sense_key || '',
      example: vocab?.example || null,
      chapterExample: row.example || null,
      importanceScore: row.importance_score,
      isStudied: false,
      cardState: 'New' as const,
      lastStudied: null,
      nextDue: null,
      totalReviews: 0,
      streakCorrect: 0,
      streakIncorrect: 0,
      stability: undefined,
      difficulty: undefined,
      firstSeenDate: null,
      scheduledDays: null
    }
  })

  logger.info(
    {
      seriesSlug,
      chapterNumber,
      vocabularyCount: vocabulary.length,
      hasProgress: !!chapterProgress,
      duration: Date.now() - startTime
    },
    'Chapter page data fetched'
  )

  return {
    series: {
      ...series,
      num_chapters: chapters.length
    },
    chapter: currentChapter,
    prevChapter,
    nextChapter,
    vocabulary,
    chapterProgress
  }
}

/**
 * Gets chapter with adjacent chapters for navigation.
 * Input: supabase client, chapter id
 * Output: Chapter with prev/next navigation data
 */
export async function getChapterWithNavigation(
  supabase: DbClient,
  chapterId: string
): Promise<{
  chapter: Tables<'chapters'>
  series: Tables<'series'>
  prevChapter: Tables<'chapters'> | null
  nextChapter: Tables<'chapters'> | null
} | null> {
  const chapter = await getChapterById(supabase, chapterId)

  if (!chapter) {
    return null
  }

  const [series, { prev, next }] = await Promise.all([
    getSeriesById(supabase, chapter.series_id),
    getAdjacentChaptersQuery(supabase, chapter.series_id, chapter.chapter_number)
  ])

  if (!series) {
    throw new Error('Series not found for chapter')
  }

  return {
    chapter,
    series,
    prevChapter: prev,
    nextChapter: next
  }
}
