import { createClient } from '@/lib/supabase/server'
import { Tables } from '@/types/database.types'

/**
 * Gets recent study sessions for a user.
 * Input: user id, limit
 * Output: Array of study session records ordered by studied_at descending
 */
export async function getRecentSessions(
  userId: string,
  limit: number = 10
): Promise<Tables<'user_chapter_study_sessions'>[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_chapter_study_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('studied_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return data || []
}

/**
 * Gets study sessions for a user within a date range.
 * Input: user id, start date, optional end date
 * Output: Array of study session records ordered by studied_at ascending
 */
export async function getSessionsByDateRange(
  userId: string,
  startDate: Date,
  endDate?: Date
): Promise<Tables<'user_chapter_study_sessions'>[]> {
  const supabase = await createClient()
  let query = supabase
    .from('user_chapter_study_sessions')
    .select('*')
    .eq('user_id', userId)
    .gte('studied_at', startDate.toISOString())
    .order('studied_at', { ascending: true })

  if (endDate) {
    query = query.lte('studied_at', endDate.toISOString())
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return data || []
}

/**
 * Gets all study sessions for a specific chapter.
 * Input: user id, chapter id
 * Output: Array of study session records ordered by studied_at descending
 */
export async function getSessionsByChapterId(
  userId: string,
  chapterId: string
): Promise<Tables<'user_chapter_study_sessions'>[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_chapter_study_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('chapter_id', chapterId)
    .order('studied_at', { ascending: false })

  if (error) {
    throw error
  }

  return data || []
}

/**
 * Counts total study sessions for a user.
 * Input: user id
 * Output: Number of sessions
 */
export async function getSessionCount(
  userId: string
): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('user_chapter_study_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) {
    throw error
  }

  return count || 0
}
