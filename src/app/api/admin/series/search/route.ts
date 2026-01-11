import { NextRequest } from 'next/server'
import { MALData } from '@/types/mal.types'
import { logger } from '@/lib/logger'
import { DbClient } from '@/lib/study/types'
import { withErrorHandler, requireAdmin, successResponse } from '@/lib/api'

/**
 * GET /api/admin/series/search
 * Searches DB for existing series + MAL API for new series.
 * Input: query string param 'q'
 * Output: { dbResults: Series[], malResults: MALSeries[] }
 */
async function handler(request: NextRequest) {
  const { user, supabase } = await requireAdmin()

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query) {
    logger.warn({ userId: user.id }, 'Empty search query')
    return successResponse({ dbResults: [], malResults: [] })
  }

  logger.debug({ userId: user.id, query }, 'Starting series search')

  const dbResults = await searchDatabase(supabase, query)
  const malResults = await searchMAL(query)

  logger.info({
    userId: user.id,
    query,
    dbResultCount: dbResults.length,
    malResultCount: malResults.length
  }, 'Series search completed')

  return successResponse({ dbResults, malResults })
}

/**
 * Search database for matching series.
 * Input: supabase client, search query
 * Output: array of Series objects
 */
async function searchDatabase(supabase: DbClient, query: string) {
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
