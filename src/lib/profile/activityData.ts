import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { logger } from '@/lib/logger'

type DbClient = SupabaseClient<Database>

export interface RecentSession {
  id: string
  startTime: Date
  endTime: Date | null
  cardsStudied: number
  accuracy: number
  timeSpentSeconds: number
  chapterId: string
}

export interface WeeklyActivityDay {
  date: string
  count: number
}

export interface GenreMastery {
  genre: string
  percentage: number
  totalCards: number
  masteredCards: number
}

/** Result type for combined progress + series query */
interface ProgressWithSeries {
  series_id: string
  cards_studied: number | null
  total_cards: number | null
  series: { id: string; genres: string[] | null } | null
}

/** Result type for chapter_vocabulary with joined chapters */
interface VocabWithChapter {
  vocabulary_id: string
  chapters: { id: string; series_id: string } | null
}

/** Aggregated genre statistics (intermediate state) */
interface GenreStats {
  total: number
  studied: number
}

/**
 * Safely parses a database timestamp string to Date.
 * Logs warning if parsing fails (indicates data corruption or bug).
 * Input: timestamp string, context object for logging
 * Output: Date object or null if invalid
 */
function parseDatabaseTimestamp(
  timestamp: string | null | undefined,
  context: {
    userId: string
    sessionId?: string
    field: string
  }
): Date | null {
  if (!timestamp) {
    logger.warn(
      {
        userId: context.userId,
        sessionId: context.sessionId,
        field: context.field
      },
      'Database timestamp is null or undefined'
    )
    return null
  }

  try {
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) {
      logger.warn(
        {
          userId: context.userId,
          sessionId: context.sessionId,
          field: context.field,
          rawValue: timestamp
        },
        'Invalid database timestamp - parsing resulted in invalid date'
      )
      return null
    }
    return date
  } catch (error) {
    logger.warn(
      {
        userId: context.userId,
        sessionId: context.sessionId,
        field: context.field,
        rawValue: timestamp,
        error: error instanceof Error ? error.message : String(error)
      },
      'Exception while parsing database timestamp'
    )
    return null
  }
}

/**
 * Gets recent study sessions for a user.
 * Input: supabase client, user id, limit
 * Output: array of recent sessions
 */
export async function getRecentSessions(
  supabase: DbClient,
  userId: string,
  limit: number = 10
): Promise<RecentSession[]> {
  const { data, error } = await supabase
    .from('user_chapter_study_sessions')
    .select('id, studied_at, cards_studied, accuracy, time_spent_seconds, chapter_id')
    .eq('user_id', userId)
    .order('studied_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  const sessions: RecentSession[] = []

  for (const session of data || []) {
    const studiedAt = parseDatabaseTimestamp(session.studied_at, {
      userId,
      sessionId: session.id,
      field: 'studied_at'
    })

    // Skip sessions with invalid timestamps
    if (!studiedAt) {
      continue
    }

    sessions.push({
      id: session.id,
      startTime: studiedAt,
      endTime: studiedAt,
      cardsStudied: session.cards_studied || 0,
      accuracy: session.accuracy || 0,
      timeSpentSeconds: session.time_spent_seconds || 0,
      chapterId: session.chapter_id
    })
  }

  return sessions
}

/**
 * Gets weekly activity data (cards per day for last 7 days).
 * Input: supabase client, user id
 * Output: array of daily activity
 */
export async function getWeeklyActivity(
  supabase: DbClient,
  userId: string
): Promise<WeeklyActivityDay[]> {
  const now = new Date()
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('user_chapter_study_sessions')
    .select('id, studied_at, cards_studied')
    .eq('user_id', userId)
    .gte('studied_at', sevenDaysAgo.toISOString())
    .order('studied_at', { ascending: true })

  if (error) {
    throw error
  }

  const sessions = data || []
  const dailyCounts = new Map<string, number>()

  for (const session of sessions) {
    const date = parseDatabaseTimestamp(session.studied_at, {
      userId,
      sessionId: session.id,
      field: 'studied_at'
    })

    // Skip invalid dates
    if (!date) {
      continue
    }

    const dateStr = date.toISOString().split('T')[0]
    const current = dailyCounts.get(dateStr) || 0
    dailyCounts.set(dateStr, current + (session.cards_studied || 0))
  }

  const result: WeeklyActivityDay[] = []
  const baseDate = new Date(now)
  baseDate.setHours(0, 0, 0, 0)
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(baseDate)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    result.push({
      date: dateStr,
      count: dailyCounts.get(dateStr) || 0
    })
  }

  return result
}

/**
 * Gets mastery by genre aggregated from series progress.
 * Input: supabase client, user id
 * Output: array of genre mastery data
 */
export async function getGenreMastery(
  supabase: DbClient,
  userId: string
): Promise<GenreMastery[]> {
  const initialData = await fetchProgressAndMasteredCards(supabase, userId)
  if (!initialData) {
    return []
  }

  const { progressWithSeries, masteredVocabIds } = initialData
  const genreStats = buildGenreStats(progressWithSeries)

  if (masteredVocabIds.length === 0) {
    return formatGenreMasteryResult(genreStats, new Map())
  }

  const vocabChapterData = await fetchVocabChapterMapping(
    supabase,
    masteredVocabIds
  )
  const seriesToGenresMap = buildSeriesToGenresMap(progressWithSeries)
  const genreMastered = countMasteredByGenre(vocabChapterData, seriesToGenresMap)

  return formatGenreMasteryResult(genreStats, genreMastered)
}

/**
 * Fetches user series progress with genres and mastered cards in parallel.
 * Input: supabase client, user id
 * Output: { progressWithSeries, masteredVocabIds } or null if no progress
 */
async function fetchProgressAndMasteredCards(
  supabase: DbClient,
  userId: string
): Promise<{
  progressWithSeries: ProgressWithSeries[]
  masteredVocabIds: string[]
} | null> {
  const [progressResult, masteredResult] = await Promise.all([
    supabase
      .from('user_series_progress_summary')
      .select(`
        series_id,
        cards_studied,
        total_cards,
        series:series_id (id, genres)
      `)
      .eq('user_id', userId),

    supabase
      .from('user_deck_srs_cards')
      .select('vocabulary_id')
      .eq('user_id', userId)
      .eq('state', 'Review')
  ])

  if (progressResult.error) throw progressResult.error
  if (masteredResult.error) throw masteredResult.error

  if (!progressResult.data || progressResult.data.length === 0) {
    return null
  }

  return {
    progressWithSeries: progressResult.data as ProgressWithSeries[],
    masteredVocabIds: (masteredResult.data || []).map(c => c.vocabulary_id)
  }
}

/**
 * Fetches chapter-series mapping for mastered vocabulary.
 * Input: supabase client, array of vocabulary IDs
 * Output: array of vocab with chapter/series mapping
 */
async function fetchVocabChapterMapping(
  supabase: DbClient,
  vocabIds: string[]
): Promise<VocabWithChapter[]> {
  const { data, error } = await supabase
    .from('chapter_vocabulary')
    .select(`
      vocabulary_id,
      chapters:chapter_id (id, series_id)
    `)
    .in('vocabulary_id', vocabIds)

  if (error) throw error
  return (data || []) as VocabWithChapter[]
}

/**
 * Builds genre statistics from series progress data.
 * Input: array of progress with series data
 * Output: map of genre to { total, studied } stats
 */
function buildGenreStats(
  progressWithSeries: ProgressWithSeries[]
): Map<string, GenreStats> {
  const genreStats = new Map<string, GenreStats>()

  for (const progress of progressWithSeries) {
    const genres = progress.series?.genres
    if (!genres) continue

    const cardsStudied = progress.cards_studied || 0
    const totalCards = progress.total_cards || 0

    for (const genre of genres) {
      const current = genreStats.get(genre) || { total: 0, studied: 0 }
      genreStats.set(genre, {
        total: current.total + totalCards,
        studied: current.studied + cardsStudied
      })
    }
  }

  return genreStats
}

/**
 * Builds a map from series ID to genres array.
 * Input: array of progress with series data
 * Output: map of series_id to genres array
 */
function buildSeriesToGenresMap(
  progressWithSeries: ProgressWithSeries[]
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const progress of progressWithSeries) {
    if (progress.series?.genres) {
      map.set(progress.series_id, progress.series.genres)
    }
  }
  return map
}

/**
 * Counts mastered vocabulary per genre using progress-derived series map.
 * Input: vocab-chapter mappings, series-to-genres map
 * Output: map of genre to mastered count
 */
function countMasteredByGenre(
  vocabChapterData: VocabWithChapter[],
  seriesToGenresMap: Map<string, string[]>
): Map<string, number> {
  const genreVocabSets = new Map<string, Set<string>>()

  for (const v of vocabChapterData) {
    const seriesId = v.chapters?.series_id
    if (!seriesId) continue

    const genres = seriesToGenresMap.get(seriesId)
    if (!genres) continue

    for (const genre of genres) {
      if (!genreVocabSets.has(genre)) {
        genreVocabSets.set(genre, new Set())
      }
      genreVocabSets.get(genre)!.add(v.vocabulary_id)
    }
  }

  const genreMastered = new Map<string, number>()
  for (const [genre, vocabSet] of genreVocabSets) {
    genreMastered.set(genre, vocabSet.size)
  }

  return genreMastered
}

/**
 * Formats genre stats and mastered counts into final result.
 * Input: genre stats map, genre mastered counts map
 * Output: sorted array of GenreMastery objects
 */
function formatGenreMasteryResult(
  genreStats: Map<string, GenreStats>,
  genreMastered: Map<string, number>
): GenreMastery[] {
  return Array.from(genreStats.entries())
    .map(([genre, stats]) => {
      const mastered = genreMastered.get(genre) || 0
      const percentage = stats.total > 0
        ? Math.round((mastered / stats.total) * 100)
        : 0
      return {
        genre,
        percentage,
        totalCards: stats.total,
        masteredCards: mastered
      }
    })
    .filter(g => g.totalCards > 0)
    .sort((a, b) => b.percentage - a.percentage)
}

