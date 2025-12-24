import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkIsAdmin } from '@/lib/admin/auth'
import { MALData } from '@/types/mal.types'


/**
 * Create series from MAL data
 * Input: MAL series data object
 * Output: { success: boolean, series?: Series }
 */
export async function POST(request: NextRequest) {
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

  const { malData }: { malData: MALData } = await request.json()

  const slug = generateSlug(
    malData.title_english || malData.title
  )
  
  const { data: existing } = await supabase
    .from('series')
    .select('id')
    .eq('slug', slug)
    .single()

  if (existing) {
    return NextResponse.json({
      success: false,
      error: 'Series with this slug already exists',
    })
  }

  const { data: series, error } = await supabase
    .from('series')
    .insert({
      name: malData.title_english || malData.title,
      korean_name: malData.title_japanese,
      alt_names: malData.titles.map(t => t.title),
      slug,
      picture_url: malData.images.jpg.image_url,
      synopsis: malData.synopsis,
      popularity: malData.popularity,
      genres: malData.genres.map(g => g.name),
      authors: malData.authors.map(a => a.name),
      num_chapters: 0,
    })
    .select('id, name, slug, picture_url')
    .single()

  if (error) {
    console.error('Create series error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create series',
    })
  }

  return NextResponse.json({
    success: true,
    series,
  })
}

/**
 * Generate URL-safe slug from title
 * Input: title string
 * Output: slug string
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
