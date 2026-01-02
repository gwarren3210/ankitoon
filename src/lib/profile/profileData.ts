import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Tables } from '@/types/database.types'
import {
  RecentSession,
  WeeklyActivityDay,
  GenreMastery,
  getRecentSessions,
  getWeeklyActivity,
  getGenreMastery
} from './activityData'

export type { RecentSession, WeeklyActivityDay, GenreMastery }

type DbClient = SupabaseClient<Database>

export interface ProfileStats {
  totalCardsStudied: number
  currentStreak: number
  totalTimeSpentSeconds: number
  averageAccuracy: number
  seriesCount: number
  totalCardsMastered: number
}

export interface ProfileData {
  profile: Tables<'profiles'>
  stats: ProfileStats
  recentSessions: RecentSession[]
  weeklyActivity: WeeklyActivityDay[]
  genreMastery: GenreMastery[]
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

  const [
    stats,
    recentSessions,
    weeklyActivity,
    genreMastery
  ] = await Promise.all([
    getProfileStats(supabase, userId),
    getRecentSessions(supabase, userId),
    getWeeklyActivity(supabase, userId),
    getGenreMastery(supabase, userId)
  ])

  return {
    profile,
    stats,
    recentSessions,
    weeklyActivity,
    genreMastery
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
    uniqueCardsResult
  ] = await Promise.all([
    supabase
      .from('user_series_progress_summary')
      .select('total_time_spent_seconds, average_accuracy, current_streak, cards_studied')
      .eq('user_id', userId),
    supabase
      .from('user_deck_srs_cards')
      .select('vocabulary_id')
      .eq('user_id', userId)
      .neq('state', 'New')
  ])

  if (seriesProgressResult.error) {
    throw seriesProgressResult.error
  }
  if (uniqueCardsResult.error) {
    throw uniqueCardsResult.error
  }

  const seriesProgress = seriesProgressResult.data || []
  const cards = uniqueCardsResult.data || []

  // Count distinct vocabulary_id across all cards
  const uniqueVocabIds = new Set(cards.map(c => c.vocabulary_id))
  const totalCardsStudied = uniqueVocabIds.size

  const totalTimeSpentSeconds = seriesProgress.reduce(
    (sum, p) => sum + (p.total_time_spent_seconds || 0),
    0
  )

  const seriesCount = seriesProgress.length

  // Calculate weighted average accuracy from series progress
  // Series accuracy already aggregates chapter data with proper weighting
  const seriesWithCards = seriesProgress.filter(
    sp => (sp.cards_studied || 0) > 0 && (sp.average_accuracy || 0) > 0
  )
  
  let averageAccuracy = 0
  if (seriesWithCards.length > 0) {
    const totalWeightedAccuracy = seriesWithCards.reduce(
      (sum, sp) => sum + ((sp.average_accuracy || 0) * (sp.cards_studied || 0)),
      0
    )
    const totalCardsForAccuracy = seriesWithCards.reduce(
      (sum, sp) => sum + (sp.cards_studied || 0),
      0
    )
    averageAccuracy = totalCardsForAccuracy > 0
      ? totalWeightedAccuracy / totalCardsForAccuracy
      : 0
  }

  const currentStreak = seriesProgress.length > 0
    ? Math.max(...seriesProgress.map(p => p.current_streak || 0))
    : 0

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
  const totalCardsMastered = masteredVocabIds.size

  return {
    totalCardsStudied,
    currentStreak,
    totalTimeSpentSeconds,
    averageAccuracy,
    seriesCount,
    totalCardsMastered
  }
}

