import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkIsAdmin } from '@/lib/admin/auth'
import { MALData } from '@/types/mal.types'

/**
 * Series search API
 * Searches DB for existing series + MAL API for new series
 * Input: query string param 'q'
 * Output: { dbResults: Series[], malResults: MALSeries[] }
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
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ 
      dbResults: [], 
      malResults: [] 
    })
  }

  const dbResults = await searchDatabase(supabase, query)
  const malResults = await searchMAL(query)

  return NextResponse.json({
    dbResults,
    malResults,
  })
}

/**
 * Search database for matching series
 * Input: supabase client, search query
 * Output: array of Series objects
 */
async function searchDatabase(
  supabase: any, 
  query: string
) {
  const { data, error } = await supabase
    .from('series')
    .select('id, name, slug, picture_url')
    .or(
      `name.ilike.%${query}%,` +
      `korean_name.ilike.%${query}%`
    )
    .limit(5)

  if (error) {
    console.error('DB search error:', error)
    return []
  }

  return data || []
}

/**
 * Search MyAnimeList API for manga series
 * Input: search query
 * Output: array of MAL series objects
 */
async function searchMAL(query: string): Promise<MALData[]> {
  const malApiUrl = 
    `https://api.jikan.moe/v4/manga?q=${
      encodeURIComponent(query)
    }&type=manhwa&limit=5&order_by=popularity&sort=desc`

  const response = await fetch(malApiUrl)
  
  if (!response.ok) {
    console.error('MAL API error:', response.statusText)
    return []
  }

  const data = await response.json()
  return data.data || []
}

