import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Tables } from '@/types/database.types'

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

  return (data || []).map(session => {
    const studiedAt = session.studied_at ? new Date(session.studied_at) : new Date()
    if (isNaN(studiedAt.getTime())) {
      return {
        id: session.id,
        startTime: new Date(),
        endTime: new Date(),
        cardsStudied: session.cards_studied || 0,
        accuracy: session.accuracy || 0,
        timeSpentSeconds: session.time_spent_seconds || 0,
        chapterId: session.chapter_id
      }
    }
    return {
      id: session.id,
      startTime: studiedAt,
      endTime: studiedAt,
      cardsStudied: session.cards_studied || 0,
      accuracy: session.accuracy || 0,
      timeSpentSeconds: session.time_spent_seconds || 0,
      chapterId: session.chapter_id
    }
  })
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
    .select('studied_at, cards_studied')
    .eq('user_id', userId)
    .gte('studied_at', sevenDaysAgo.toISOString())
    .order('studied_at', { ascending: true })

  if (error) {
    throw error
  }

  const sessions = data || []
  const dailyCounts = new Map<string, number>()

  sessions.forEach(session => {
    if (!session.studied_at) return
    try {
      const date = new Date(session.studied_at)
      if (isNaN(date.getTime())) return
      const dateStr = date.toISOString().split('T')[0]
      const current = dailyCounts.get(dateStr) || 0
      dailyCounts.set(dateStr, current + (session.cards_studied || 0))
    } catch (err) {
      // Skip invalid dates
      return
    }
  })

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
 * TODO: function too long
 */
export async function getGenreMastery(
  supabase: DbClient,
  userId: string
): Promise<GenreMastery[]> {
  const { data: progressData, error: progressError } = await supabase
    .from('user_series_progress_summary')
    .select('series_id, cards_studied, total_cards')
    .eq('user_id', userId)

  if (progressError) {
    throw progressError
  }

  if (!progressData || progressData.length === 0) {
    return []
  }

  const seriesIds = progressData.map(p => p.series_id)
  const { data: seriesData, error: seriesError } = await supabase
    .from('series')
    .select('id, genres')
    .in('id', seriesIds)

  if (seriesError) {
    throw seriesError
  }

  const seriesMap = new Map(
    (seriesData || []).map(s => [s.id, s])
  )

  const genreStats = new Map<string, { total: number; studied: number }>()

  progressData.forEach(progress => {
    const series = seriesMap.get(progress.series_id)
    if (!series || !series.genres) return

    const cardsStudied = progress.cards_studied || 0
    const totalCards = progress.total_cards || 0

    series.genres.forEach(genre => {
      const current = genreStats.get(genre) || { total: 0, studied: 0 }
      genreStats.set(genre, {
        total: current.total + totalCards,
        studied: current.studied + cardsStudied
      })
    })
  })

  const { data: masteredCardsData, error: masteredError } = await supabase
    .from('user_deck_srs_cards')
    .select('vocabulary_id')
    .eq('user_id', userId)
    .eq('state', 'Review')

  if (masteredError) {
    throw masteredError
  }

  const masteredVocabIds = new Set(
    (masteredCardsData || []).map(c => c.vocabulary_id)
  )

  if (masteredVocabIds.size === 0) {
    return Array.from(genreStats.entries())
      .map(([genre, stats]) => ({
        genre,
        percentage: 0,
        totalCards: stats.total,
        masteredCards: 0
      }))
      .filter(g => g.totalCards > 0)
      .sort((a, b) => b.percentage - a.percentage)
  }

  const { data: vocabChapterData, error: vocabError } = await supabase
    .from('chapter_vocabulary')
    .select('vocabulary_id, chapter_id')
    .in('vocabulary_id', Array.from(masteredVocabIds))

  if (vocabError) {
    throw vocabError
  }

  if (!vocabChapterData || vocabChapterData.length === 0) {
    return Array.from(genreStats.entries())
      .map(([genre, stats]) => ({
        genre,
        percentage: 0,
        totalCards: stats.total,
        masteredCards: 0
      }))
      .filter(g => g.totalCards > 0)
      .sort((a, b) => b.percentage - a.percentage)
  }

  const chapterIds = [...new Set(vocabChapterData.map(v => v.chapter_id))]
  const { data: chaptersData, error: chaptersError } = await supabase
    .from('chapters')
    .select('id, series_id')
    .in('id', chapterIds)

  if (chaptersError) {
    throw chaptersError
  }

  const chapterToSeriesMap = new Map(
    (chaptersData || []).map(c => [c.id, c.series_id])
  )

  const masteredSeriesIds = new Set(
    vocabChapterData
      .map(v => chapterToSeriesMap.get(v.chapter_id))
      .filter((id): id is string => id !== undefined)
  )

  if (masteredSeriesIds.size === 0) {
    return Array.from(genreStats.entries())
      .map(([genre, stats]) => ({
        genre,
        percentage: 0,
        totalCards: stats.total,
        masteredCards: 0
      }))
      .filter(g => g.totalCards > 0)
      .sort((a, b) => b.percentage - a.percentage)
  }

  const { data: masteredSeriesData, error: masteredSeriesError } = await supabase
    .from('series')
    .select('id, genres')
    .in('id', Array.from(masteredSeriesIds))

  if (masteredSeriesError) {
    throw masteredSeriesError
  }

  const genreMasteredVocab = new Map<string, Set<string>>()

  vocabChapterData.forEach(v => {
    const seriesId = chapterToSeriesMap.get(v.chapter_id)
    if (!seriesId) return

    const series = masteredSeriesData?.find(s => s.id === seriesId)
    if (!series || !series.genres) return

    series.genres.forEach(genre => {
      if (!genreMasteredVocab.has(genre)) {
        genreMasteredVocab.set(genre, new Set())
      }
      genreMasteredVocab.get(genre)!.add(v.vocabulary_id)
    })
  })

  const genreMastered = new Map<string, number>()
  genreMasteredVocab.forEach((vocabSet, genre) => {
    genreMastered.set(genre, vocabSet.size)
  })

  const result: GenreMastery[] = Array.from(genreStats.entries())
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

  return result
}

