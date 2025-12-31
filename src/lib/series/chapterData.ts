import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Tables } from '@/types/database.types'
import { ChapterVocabulary } from '@/types/series.types'
import { logger } from '@/lib/pipeline/logger'

type DbClient = SupabaseClient<Database>

type ChapterVocabularyRow = {
  vocabulary_id: string
  importance_score: number
  vocabulary: {
    id: string
    term: string
    definition: string
    example: string | null
    sense_key: string
  } | null
}

/**
 * Gets chapter by series ID and chapter number.
 * Input: supabase client, series id, chapter number
 * Output: Chapter data or null
 */
export async function getChapterByNumber(
  supabase: DbClient,
  seriesId: string,
  chapterNumber: number
): Promise<Tables<'chapters'> | null> {
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
 * Gets vocabulary for a chapter with full vocabulary details and card states.
 * Input: supabase client, chapter id, optional user id
 * Output: Array of chapter vocabulary with full details and card states
 */
export async function getChapterVocabulary(
  supabase: DbClient,
  chapterId: string,
  userId?: string
): Promise<ChapterVocabulary[]> {
  const { data, error } = await supabase
    .from('chapter_vocabulary')
    .select(`
      vocabulary_id,
      importance_score,
      vocabulary (
        id,
        term,
        definition,
        example,
        sense_key
      )
    `)
    .eq('chapter_id', chapterId)
    .order('importance_score', { ascending: false })

  if (error) {
    throw error
  }

  const vocabulary = (data || []).map((item: ChapterVocabularyRow) => {
    const vocab = item.vocabulary
    return {
      vocabularyId: item.vocabulary_id,
      term: vocab?.term || '',
      definition: vocab?.definition || '',
      senseKey: vocab?.sense_key || '',
      example: vocab?.example || null,
      importanceScore: item.importance_score
    }
  })

  // If user is provided, fetch card states
  if (userId) {
    // Get deck for this chapter
    const { data: deck } = await supabase
      .from('user_chapter_decks')
      .select('id')
      .eq('user_id', userId)
      .eq('chapter_id', chapterId)
      .single()

    if (deck) {
      // Get card states for all vocabulary in this chapter
      const vocabularyIds = vocabulary.map(v => v.vocabularyId)
      const { data: cards } = await supabase
        .from('user_deck_srs_cards')
        .select(`
          vocabulary_id,
          state,
          last_reviewed_date,
          next_review_date,
          total_reviews,
          streak_correct,
          streak_incorrect,
          stability,
          difficulty,
          first_seen_date,
          scheduled_days
        `)
        .eq('user_id', userId)
        .eq('deck_id', deck.id)
        .in('vocabulary_id', vocabularyIds)

      // Create map of vocabulary_id to card state
      const cardStateMap = new Map<string, {
        state: 'New' | 'Learning' | 'Review' | 'Relearning'
        lastStudied: string | null
        nextDue: string | null
        totalReviews: number
        streakCorrect: number
        streakIncorrect: number
        stability: number
        difficulty: number
        firstSeenDate: string | null
        scheduledDays: number | null
      }>()

      for (const card of cards || []) {
        cardStateMap.set(card.vocabulary_id, {
          state: card.state as 'New' | 'Learning' | 'Review' | 'Relearning',
          lastStudied: card.last_reviewed_date,
          nextDue: card.next_review_date,
          totalReviews: card.total_reviews,
          streakCorrect: card.streak_correct,
          streakIncorrect: card.streak_incorrect,
          stability: card.stability,
          difficulty: card.difficulty,
          firstSeenDate: card.first_seen_date,
          scheduledDays: card.scheduled_days
        })
      }

      // Merge card states with vocabulary
      return vocabulary.map(vocab => {
        const cardData = cardStateMap.get(vocab.vocabularyId)
        return {
          ...vocab,
          isStudied: cardData ? cardData.state !== 'New' : false,
          cardState: cardData?.state || 'New',
          lastStudied: cardData?.lastStudied || null,
          nextDue: cardData?.nextDue || null,
          totalReviews: cardData?.totalReviews || 0,
          streakCorrect: cardData?.streakCorrect || 0,
          streakIncorrect: cardData?.streakIncorrect || 0,
          stability: cardData?.stability,
          difficulty: cardData?.difficulty,
          firstSeenDate: cardData?.firstSeenDate || null,
          scheduledDays: cardData?.scheduledDays || null
        }
      })
    }
  }

  return vocabulary
}

/**
 * Gets adjacent chapters (previous and next) for navigation.
 * Input: supabase client, series id, current chapter number
 * Output: Object with prev and next chapter data (or null)
 */
export async function getAdjacentChapters(
  supabase: DbClient,
  seriesId: string,
  chapterNumber: number
): Promise<{
  prev: Tables<'chapters'> | null
  next: Tables<'chapters'> | null
}> {
  // Get previous chapter (highest chapter number less than current)
  const { data: prevData, error: prevError } = await supabase
    .from('chapters')
    .select('*')
    .eq('series_id', seriesId)
    .lt('chapter_number', chapterNumber)
    .order('chapter_number', { ascending: false })
    .limit(1)
    .single()

  // Get next chapter (lowest chapter number greater than current)
  const { data: nextData, error: nextError } = await supabase
    .from('chapters')
    .select('*')
    .eq('series_id', seriesId)
    .gt('chapter_number', chapterNumber)
    .order('chapter_number', { ascending: true })
    .limit(1)
    .single()

  // Handle errors - if no previous/next chapter, that's fine (not an error)
  const prev = prevError?.code === 'PGRST116' ? null : (prevData || null)
  const next = nextError?.code === 'PGRST116' ? null : (nextData || null)

  // Throw if there are actual errors (not just no rows)
  if (prevError && prevError.code !== 'PGRST116') throw prevError
  if (nextError && nextError.code !== 'PGRST116') throw nextError

  return { prev, next }
}

/**
 * Gets all chapter page data in optimized queries.
 * Input: supabase client, series slug, chapter number, optional user id
 * Output: Combined chapter page data
 */
export async function getChapterPageData(
  supabase: DbClient,
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
    const seriesData = await fetchSeriesWithChapters(supabase, slug)
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

    const { vocabulary, chapterProgress } = await fetchChapterData(supabase, chapter.id, userId)

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

/**
 * Fetches series with all chapters in a single query.
 * Input: supabase client, series slug
 * Output: Series data with chapters array and num_chapters count, or null
 */
async function fetchSeriesWithChapters(
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
function sortChaptersByNumber(
  chapters: Tables<'chapters'>[]
): Tables<'chapters'>[] {
  return [...chapters].sort((a, b) => a.chapter_number - b.chapter_number)
}

/**
 * Finds current chapter and adjacent chapters from sorted array.
 * Input: sorted chapters array, target chapter number
 * Output: current chapter, previous chapter, next chapter
 */
function findAdjacentChapters(
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

  const currentIndex = sortedChapters.findIndex(ch => ch.id === currentChapter.id)
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
async function fetchChapterData(
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
