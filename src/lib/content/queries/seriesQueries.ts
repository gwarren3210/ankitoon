import { createClient } from '@/lib/supabase/server'
import { Tables } from '@/types/database.types'

/**
 * Gets series by slug.
 * Input: series slug
 * Output: Series row or null if not found
 */
export async function getSeriesBySlug(
  slug: string
): Promise<Tables<'series'> | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('series')
    .select('*')
    .eq('slug', slug)
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
 * Gets series by ID.
 * Input: series id
 * Output: Series row or null if not found
 */
export async function getSeriesById(
  seriesId: string
): Promise<Tables<'series'> | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('series')
    .select('*')
    .eq('id', seriesId)
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
 * Gets all series ordered by name.
 * Input: none
 * Output: Array of all series
 */
export async function getAllSeries(): Promise<Tables<'series'>[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('series')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    throw error
  }

  return data || []
}

/**
 * Gets multiple series by their IDs in batch.
 * Input: array of series ids
 * Output: Map of series id to series data
 */
export async function getSeriesBatch(
  seriesIds: string[]
): Promise<Map<string, Tables<'series'>>> {
  if (seriesIds.length === 0) {
    return new Map()
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('series')
    .select('*')
    .in('id', seriesIds)

  if (error) {
    throw error
  }

  const seriesMap = new Map<string, Tables<'series'>>()
  for (const series of data || []) {
    seriesMap.set(series.id, series)
  }

  return seriesMap
}
