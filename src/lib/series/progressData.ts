import { createClient } from '@/lib/supabase/server'
import { Tables } from '@/types/database.types'

/**
 * Gets series progress for a user.
 * Input: user id, series id
 * Output: Series progress data or null
 */
export async function getSeriesProgress(
  userId: string,
  seriesId: string
): Promise<Tables<'user_series_progress_summary'> | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_series_progress_summary')
    .select('*')
    .eq('user_id', userId)
    .eq('series_id', seriesId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned - user hasn't studied this series yet
      return null
    }
    throw error
  }

  return data
}

/**
 * Gets chapter progress for a user.
 * Input: user id, chapter id
 * Output: Chapter progress data or null
 */
export async function getChapterProgress(
  userId: string,
  chapterId: string
): Promise<Tables<'user_chapter_progress_summary'> | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_chapter_progress_summary')
    .select('*')
    .eq('user_id', userId)
    .eq('chapter_id', chapterId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned - user hasn't studied this chapter yet
      return null
    }
    throw error
  }

  return data
}

/**
 * Gets progress for multiple chapters in batch.
 * Input: user id, array of chapter ids
 * Output: Map of chapter id to progress data
 */
export async function getChaptersProgressBatch(
  userId: string,
  chapterIds: string[]
): Promise<Map<string, Tables<'user_chapter_progress_summary'>>> {
  if (chapterIds.length === 0) {
    return new Map()
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_chapter_progress_summary')
    .select('*')
    .eq('user_id', userId)
    .in('chapter_id', chapterIds)

  if (error) {
    throw error
  }

  const progressMap = new Map<string, Tables<'user_chapter_progress_summary'>>()
  for (const progress of data || []) {
    progressMap.set(progress.chapter_id, progress)
  }

  return progressMap
}

/**
 * Gets progress for multiple series in batch.
 * Input: user id, array of series ids
 * Output: Map of series id to progress data
 */
export async function getSeriesProgressBatch(
  userId: string,
  seriesIds: string[]
): Promise<Map<string, Tables<'user_series_progress_summary'>>> {
  if (seriesIds.length === 0) {
    return new Map()
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_series_progress_summary')
    .select('*')
    .eq('user_id', userId)
    .in('series_id', seriesIds)

  if (error) {
    throw error
  }

  const progressMap = new Map<string, Tables<'user_series_progress_summary'>>()
  for (const progress of data || []) {
    progressMap.set(progress.series_id, progress)
  }

  return progressMap
}
