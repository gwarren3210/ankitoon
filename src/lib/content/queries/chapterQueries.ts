import { createClient } from '@/lib/supabase/server'
import { Tables } from '@/types/database.types'

/**
 * Gets chapter by ID.
 * Input: chapter id
 * Output: Chapter row or null if not found
 */
export async function getChapterById(
  chapterId: string
): Promise<Tables<'chapters'> | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('id', chapterId)
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
 * Gets chapter by series ID and chapter number.
 * Input: series id, chapter number
 * Output: Chapter row or null if not found
 */
export async function getChapterByNumber(
  seriesId: string,
  chapterNumber: number
): Promise<Tables<'chapters'> | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('series_id', seriesId)
    .eq('chapter_number', chapterNumber)
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
 * Gets all chapters for a series ordered by chapter number.
 * Input: series id
 * Output: Array of chapters ordered by number
 */
export async function getChaptersBySeriesId(
  seriesId: string
): Promise<Tables<'chapters'>[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('series_id', seriesId)
    .order('chapter_number', { ascending: true })

  if (error) {
    throw error
  }

  return data || []
}

/**
 * Gets series with all chapters in a single query.
 * Input: series slug
 * Output: Object with series and chapters array, or null
 */
export async function getSeriesWithChapters(
  slug: string
): Promise<{
  series: Tables<'series'>
  chapters: Tables<'chapters'>[]
} | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
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

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw error
  }

  if (!data) {
    return null
  }

  const chapters = (data.chapters as unknown as Tables<'chapters'>[]) || []
  const series = {
    ...data,
    chapters: undefined
  } as Tables<'series'>

  return { series, chapters }
}

/**
 * Gets previous and next chapters for navigation.
 * Input: series id, current chapter number
 * Output: Object with prev and next chapters (or null)
 */
export async function getAdjacentChapters(
  seriesId: string,
  chapterNumber: number
): Promise<{
  prev: Tables<'chapters'> | null
  next: Tables<'chapters'> | null
}> {
  const supabase = await createClient()
  const { data: prevData, error: prevError } = await supabase
    .from('chapters')
    .select('*')
    .eq('series_id', seriesId)
    .lt('chapter_number', chapterNumber)
    .order('chapter_number', { ascending: false })
    .limit(1)
    .single()

  const { data: nextData, error: nextError } = await supabase
    .from('chapters')
    .select('*')
    .eq('series_id', seriesId)
    .gt('chapter_number', chapterNumber)
    .order('chapter_number', { ascending: true })
    .limit(1)
    .single()

  const prev = prevError?.code === 'PGRST116' ? null : (prevData || null)
  const next = nextError?.code === 'PGRST116' ? null : (nextData || null)

  if (prevError && prevError.code !== 'PGRST116') throw prevError
  if (nextError && nextError.code !== 'PGRST116') throw nextError

  return { prev, next }
}

/**
 * Counts chapters for a single series.
 * Input: series id
 * Output: Number of chapters
 */
export async function getChapterCount(
  seriesId: string
): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('chapters')
    .select('id', { count: 'exact', head: true })
    .eq('series_id', seriesId)

  if (error) {
    throw error
  }

  return count || 0
}

/**
 * Gets all chapters for multiple series in a single query.
 * Input: array of series ids
 * Output: Map of series id to chapters array
 */
export async function getChaptersBySeriesIdBatch(
  seriesIds: string[]
): Promise<Map<string, Tables<'chapters'>[]>> {
  if (seriesIds.length === 0) {
    return new Map()
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .in('series_id', seriesIds)
    .order('chapter_number', { ascending: true })

  if (error) {
    throw error
  }

  const chapterMap = new Map<string, Tables<'chapters'>[]>()
  for (const seriesId of seriesIds) {
    chapterMap.set(seriesId, [])
  }

  for (const chapter of data || []) {
    const chapters = chapterMap.get(chapter.series_id)
    if (chapters) {
      chapters.push(chapter)
    }
  }

  return chapterMap
}

/**
 * Counts chapters for multiple series in batch.
 * Input: array of series ids
 * Output: Map of series id to chapter count
 */
export async function getChapterCountsBatch(
  seriesIds: string[]
): Promise<Map<string, number>> {
  if (seriesIds.length === 0) {
    return new Map()
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('chapters')
    .select('series_id')
    .in('series_id', seriesIds)

  if (error) {
    throw error
  }

  const countMap = new Map<string, number>()
  for (const seriesId of seriesIds) {
    countMap.set(seriesId, 0)
  }

  for (const row of data || []) {
    const current = countMap.get(row.series_id) || 0
    countMap.set(row.series_id, current + 1)
  }

  return countMap
}
