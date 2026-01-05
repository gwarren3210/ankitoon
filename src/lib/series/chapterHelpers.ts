import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Tables } from '@/types/database.types'
import { ChapterVocabulary } from '@/types/series.types'
import { logger } from '@/lib/logger'
import { getChapterVocabulary } from '@/lib/series/chapterVocabulary'

type DbClient = SupabaseClient<Database>

/**
 * Fetches series with all chapters in a single query.
 * Input: supabase client, series slug
 * Output: Series data with chapters array and num_chapters count, or null
 */
export async function fetchSeriesWithChapters(
  supabase: DbClient,
  slug: string
): Promise<{
  series: Tables<'series'> & { num_chapters: number }
  allChapters: Tables<'chapters'>[]
} | null> {
  try {
    const { data: seriesData, error: seriesError } = await supabase
      .from('series')
      .select(`
        *,
        chapters (
          id,
          chapter_number,
          title,
          series_id,
          external_url,
          created_at
        )
      `)
      .eq('slug', slug)
      .single()

    if (seriesError) {
      if (seriesError.code === 'PGRST116') {
        logger.debug({ slug, errorCode: seriesError.code }, 'Series not found')
        return null
      }
      logger.error(
        { slug, error: seriesError.message, code: seriesError.code },
        'Error fetching series with chapters'
      )
      throw seriesError
    }

    if (!seriesData) {
      return null
    }

    const allChapters = (seriesData.chapters as Tables<'chapters'>[]) || []
    const series = {
      ...seriesData,
      chapters: undefined,
      num_chapters: allChapters.length
    } as Tables<'series'> & { num_chapters: number }

    logger.debug(
      { slug, seriesId: series.id, chapterCount: allChapters.length },
      'Series with chapters fetched'
    )

    return { series, allChapters }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error({ slug, error: errorMessage }, 'Failed to fetch series with chapters')
    throw error
  }
}

/**
 * Sorts chapters by chapter number.
 * Input: array of chapters
 * Output: sorted array of chapters
 */
export function sortChaptersByNumber(
  chapters: Tables<'chapters'>[]
): Tables<'chapters'>[] {
  return [...chapters].sort((a, b) => a.chapter_number - b.chapter_number)
}

/**
 * Finds current chapter and adjacent chapters from sorted array.
 * Input: sorted chapters array, target chapter number
 * Output: current chapter, previous chapter, next chapter
 */
export function findAdjacentChapters(
  sortedChapters: Tables<'chapters'>[],
  chapterNumber: number
): {
  chapter: Tables<'chapters'> | null
  prevChapter: Tables<'chapters'> | null
  nextChapter: Tables<'chapters'> | null
} {
  const currentChapter = sortedChapters.find(
    ch => ch.chapter_number === chapterNumber
  ) || null

  if (!currentChapter) {
    return {
      chapter: null,
      prevChapter: null,
      nextChapter: null
    }
  }

  const currentIndex = sortedChapters.findIndex(
    ch => ch.id === currentChapter.id
  )
  const prevChapter = currentIndex > 0 ? sortedChapters[currentIndex - 1] : null
  const nextChapter =
    currentIndex < sortedChapters.length - 1
      ? sortedChapters[currentIndex + 1]
      : null

  return { chapter: currentChapter, prevChapter, nextChapter }
}

/**
 * Fetches vocabulary and progress data in parallel.
 * Input: supabase client, chapter id, optional user id
 * Output: vocabulary array and chapter progress (or null)
 */
export async function fetchChapterData(
  supabase: DbClient,
  chapterId: string,
  userId?: string
): Promise<{
  vocabulary: ChapterVocabulary[]
  chapterProgress: Tables<'user_chapter_progress_summary'> | null
}> {
  try {
    const [vocabulary, progressData] = await Promise.all([
      getChapterVocabulary(supabase, chapterId, userId).catch(error => {
        logger.error(
          {
            chapterId,
            userId: userId ? 'present' : 'absent',
            error: error instanceof Error ? error.message : String(error)
          },
          'Failed to fetch chapter vocabulary'
        )
        throw error
      }),
      userId
        ? supabase
            .from('user_chapter_progress_summary')
            .select('*')
            .eq('user_id', userId)
            .eq('chapter_id', chapterId)
            .single()
            .then(({ data, error }) => {
              if (error?.code === 'PGRST116') {
                logger.debug(
                  { chapterId, userId },
                  'No progress found for chapter'
                )
                return null
              }
              if (error) {
                logger.error(
                  {
                    chapterId,
                    userId,
                    error: error.message,
                    code: error.code
                  },
                  'Error fetching chapter progress'
                )
                throw error
              }
              return data
            })
        : Promise.resolve(null)
    ])

    logger.debug(
      {
        chapterId,
        vocabularyCount: vocabulary.length,
        hasProgress: !!progressData
      },
      'Chapter data fetched'
    )

    return { vocabulary, chapterProgress: progressData }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(
      { chapterId, userId: userId ? 'present' : 'absent', error: errorMessage },
      'Failed to fetch chapter data'
    )
    throw error
  }
}

