import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Tables } from '@/types/database.types'

type DbClient = SupabaseClient<Database>

/**
 * Gets series progress for a user.
 * Input: supabase client, user id, series id
 * Output: Series progress data or null if user hasn't studied this series
 */
export async function getSeriesProgress(
  supabase: DbClient,
  userId: string,
  seriesId: string
): Promise<Tables<'user_series_progress_summary'> | null> {
  const { data, error } = await supabase
    .from('user_series_progress_summary')
    .select('*')
    .eq('user_id', userId)
    .eq('series_id', seriesId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw error
  }

  return data
}

/**
 * Gets progress for multiple series in batch.
 * Input: supabase client, user id, array of series ids
 * Output: Map of series id to progress data
 */
export async function getSeriesProgressBatch(
  supabase: DbClient,
  userId: string,
  seriesIds: string[]
): Promise<Map<string, Tables<'user_series_progress_summary'>>> {
  if (seriesIds.length === 0) {
    return new Map()
  }

  const { data, error } = await supabase
    .from('user_series_progress_summary')
    .select('*')
    .eq('user_id', userId)
    .in('series_id', seriesIds)

  if (error) {
    throw error
  }

  const progressMap = new Map<string, Tables<'user_series_progress_summary'>>>()
  for (const progress of data || []) {
    progressMap.set(progress.series_id, progress)
  }

  return progressMap
}

/**
 * Gets all series progress for a user.
 * Input: supabase client, user id
 * Output: Array of all series progress records for the user
 */
export async function getAllSeriesProgress(
  supabase: DbClient,
  userId: string
): Promise<Tables<'user_series_progress_summary'>[]> {
  const { data, error } = await supabase
    .from('user_series_progress_summary')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    throw error
  }

  return data || []
}

/**
 * Gets series progress with genres joined.
 * Input: supabase client, user id
 * Output: Array of progress records with series genres
 */
export async function getSeriesProgressWithGenres(
  supabase: DbClient,
  userId: string
): Promise<(Tables<'user_series_progress_summary'> & {
  series: { genres: string[] | null }
})[]> {
  const { data, error } = await supabase
    .from('user_series_progress_summary')
    .select(`
      *,
      series!inner(genres)
    `)
    .eq('user_id', userId)

  if (error) {
    throw error
  }

  return (data || []) as (Tables<'user_series_progress_summary'> & {
    series: { genres: string[] | null }
  })[]
}
