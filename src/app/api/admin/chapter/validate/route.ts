import { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import {
  withErrorHandler,
  requireAdmin,
  successResponse,
  BadRequestError
} from '@/lib/api'

/**
 * GET /api/admin/chapter/validate
 * Checks if chapter already exists for series.
 * Input: seriesId and chapterNumber query params
 * Output: { exists: boolean }
 */
async function handler(request: NextRequest) {
  const { supabase } = await requireAdmin()

  const searchParams = request.nextUrl.searchParams
  const seriesId = searchParams.get('series_id')
  const chapterNumber = parseInt(searchParams.get('chapter_number') || '0')

  if (!seriesId || isNaN(chapterNumber)) {
    throw new BadRequestError('Missing parameters: series_id and chapter_number required')
  }

  const { data, error } = await supabase
    .from('chapters')
    .select('id')
    .eq('series_id', seriesId)
    .eq('chapter_number', chapterNumber)
    .single()

  // PGRST116 is "not found" - this is expected, not an error
  if (error && error.code !== 'PGRST116') {
    logger.error({ seriesId, chapterNumber, error }, 'Chapter validation error')
    throw new Error('Validation failed')
  }

  return successResponse({ exists: !!data })
}

export const GET = withErrorHandler(handler)
