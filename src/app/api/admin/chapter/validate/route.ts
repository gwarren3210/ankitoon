import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkIsAdmin } from '@/lib/admin/auth'
import { logger } from '@/lib/logger'

/**
 * Chapter validation API
 * Checks if chapter already exists for series
 * Input: seriesId and chapterNumber query params
 * Output: { exists: boolean }
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (!user || authError) {
    logger.warn({ authError }, 'Authentication failed for chapter validation')
    return NextResponse.json(
      { error: 'Unauthorized' }, 
      { status: 401 }
    )
  }

  const isAdmin = await checkIsAdmin(supabase, user.id)
  if (!isAdmin) {
    logger.warn({ userId: user.id }, 'Admin access required for chapter validation')
    return NextResponse.json(
      { error: 'Admin access required' }, 
      { status: 403 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const seriesId = searchParams.get('series_id')
  const chapterNumber = parseInt(searchParams.get('chapter_number') || '0')

  if (!seriesId || isNaN(chapterNumber)) {
    logger.warn({ userId: user.id, seriesId, chapterNumber }, 'Missing or invalid parameters for chapter validation')
    return NextResponse.json(
      { error: 'Missing parameters: series_id and chapter_number required' },
      { status: 400 }
    )
  }

  logger.debug({ userId: user.id, seriesId, chapterNumber }, 'Validating chapter existence')
  const { data, error } = await supabase
    .from('chapters')
    .select('id')
    .eq('series_id', seriesId)
    .eq('chapter_number', chapterNumber)
    .single()

  if (error && error.code !== 'PGRST116') {
    logger.error({ userId: user.id, seriesId, chapterNumber, error }, 'Chapter validation error')
    return NextResponse.json({
      error: 'Validation failed',
    })
  }

  const exists = !!data
  logger.info({ userId: user.id, seriesId, chapterNumber, exists }, 'Chapter validation completed')
  return NextResponse.json({
    exists,
  })
}

