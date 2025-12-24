import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkIsAdmin } from '@/lib/admin/auth'

/**
 * Chapter validation API
 * Checks if chapter already exists for series
 * Input: seriesId and chapterNumber query params
 * Output: { exists: boolean }
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' }, 
      { status: 401 }
    )
  }

  const isAdmin = await checkIsAdmin(supabase, user.id)
  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Admin access required' }, 
      { status: 403 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const seriesId = searchParams.get('series_id')
  const chapterNumber = parseInt(searchParams.get('chapter_number') || '0')

  if (!seriesId || isNaN(chapterNumber)) {
    return NextResponse.json(
      { error: 'Missing parameters: series_id and chapter_number required' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('chapters')
    .select('id')
    .eq('series_id', seriesId)
    .eq('chapter_number', chapterNumber)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Chapter validation error:', error)
    return NextResponse.json({
      error: 'Validation failed',
    })
  }

  return NextResponse.json({
    exists: !!data,
  })
}

