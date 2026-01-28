import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MALData } from '@/types/mal.types'
import { logger } from '@/lib/logger'
import { withErrorHandler, requireAdmin, successResponse } from '@/lib/api'

/**
 * GET /api/admin/series/search
 * Searches DB for existing series + MAL API for new series.
 * Input: query string param 'q'
 * Output: { dbResults: Series[], malResults: MALSeries[] }
 */
async function handler(request: NextRequest) {
  await requireAdmin()

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query) {
    return successResponse({ dbResults: [], malResults: [] })
  }

  const dbResults = await searchDatabase(query)
  const malResults = await searchMAL(query)

  return successResponse({ dbResults, malResults })
}

/**
 * Search database for matching series.
 * Input: search query
 * Output: array of Series objects
 */
async function searchDatabase(query: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('series')
    .select('id, name, slug, picture_url')
    .or(`name.ilike.%${query}%,korean_name.ilike.%${query}%`)
    .limit(5)

  if (error) {
    logger.error({ query, error }, 'DB search error')
    return []
  }

  return data || []
}

/**
 * Search MyAnimeList API for manga series.
 * Input: search query
 * Output: array of MAL series objects
 */
async function searchMAL(query: string): Promise<MALData[]> {
  const malApiUrl =
    `https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&type=manhwa&limit=5&order_by=popularity&sort=desc`

  const response = await fetch(malApiUrl)

  if (!response.ok) {
    logger.error({ query, response }, 'MAL API error')
    return []
  }

  const data = await response.json()
  return data.data || []
}

export const GET = withErrorHandler(handler)
