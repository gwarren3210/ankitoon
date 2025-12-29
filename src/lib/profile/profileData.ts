import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Tables } from '@/types/database.types'

type DbClient = SupabaseClient<Database>

export interface ProfileStats {
  totalCardsStudied: number
  currentStreak: number
  totalTimeSpentSeconds: number
  averageAccuracy: number
  seriesCount: number
}

export interface ProfileData {
  profile: Tables<'profiles'>
  stats: ProfileStats
}

/**
 * Gets user profile with aggregated statistics.
 * Input: supabase client, user id
 * Output: Profile data with stats
 * NOTE: two separate queries are used to fetch profile and stats
 */
export async function getProfileData(
  supabase: DbClient,
  userId: string
): Promise<ProfileData> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (profileError) {
    throw profileError
  }

  if (!profile) {
    throw new Error('Profile not found')
  }

  const stats = await getProfileStats(supabase, userId)

  return {
    profile,
    stats
  }
}

/**
 * Gets aggregated statistics for a user.
 * Input: supabase client, user id
 * Output: Profile statistics
 */
export async function getProfileStats(
  supabase: DbClient,
  userId: string
): Promise<ProfileStats> {
  const [
    seriesProgressResult,
    chapterProgressResult,
    studySessionsResult
  ] = await Promise.all([
    supabase
      .from('user_series_progress_summary')
      .select('cards_studied, total_time_spent_seconds, average_accuracy, current_streak')
      .eq('user_id', userId),
    supabase
      .from('user_chapter_progress_summary')
      .select('cards_studied, time_spent_seconds, accuracy')
      .eq('user_id', userId),
    supabase
      .from('user_chapter_study_sessions')
      .select('cards_studied, accuracy, time_spent_seconds')
      .eq('user_id', userId)
  ])

  if (seriesProgressResult.error) {
    throw seriesProgressResult.error
  }
  if (chapterProgressResult.error) {
    throw chapterProgressResult.error
  }
  if (studySessionsResult.error) {
    throw studySessionsResult.error
  }

  const seriesProgress = seriesProgressResult.data || []
  const chapterProgress = chapterProgressResult.data || []
  const studySessions = studySessionsResult.data || []

  const totalCardsStudied = seriesProgress.reduce(
    (sum, p) => sum + (p.cards_studied || 0),
    0
  )

  const totalTimeSpentSeconds = seriesProgress.reduce(
    (sum, p) => sum + (p.total_time_spent_seconds || 0),
    0
  )

  const seriesCount = seriesProgress.length

  const allAccuracies = [
    ...seriesProgress.map(p => p.average_accuracy || 0),
    ...chapterProgress.map(p => p.accuracy || 0),
    ...studySessions.map(s => s.accuracy || 0)
  ].filter(a => a > 0)

  const averageAccuracy = allAccuracies.length > 0
    ? allAccuracies.reduce((sum, a) => sum + a, 0) / allAccuracies.length
    : 0

  const currentStreak = seriesProgress.length > 0
    ? Math.max(...seriesProgress.map(p => p.current_streak || 0))
    : 0

  return {
    totalCardsStudied,
    currentStreak,
    totalTimeSpentSeconds,
    averageAccuracy,
    seriesCount
  }
}

