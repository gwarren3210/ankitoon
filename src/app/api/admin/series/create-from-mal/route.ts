import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MALData } from '@/types/mal.types'
import { logger } from '@/lib/logger'
import {
  withErrorHandler,
  requireAdmin,
  successResponse,
  ConflictError,
  DatabaseError,
  InvalidJsonError
} from '@/lib/api'

/**
 * POST /api/admin/series/create-from-mal
 * Create series from MAL data.
 * Input: MAL series data object
 * Output: { success: boolean, series?: Series }
 */
async function handler(request: NextRequest) {
  const { user } = await requireAdmin()
  const supabase = await createClient()

  let malData: MALData
  try {
    const body = await request.json()
    malData = body.malData
  } catch {
    throw new InvalidJsonError()
  }

  const slug = generateSlug(malData.title_english || malData.title)

  const { data: existing } = await supabase
    .from('series')
    .select('id')
    .eq('slug', slug)
    .single()

  if (existing) {
    throw new ConflictError('Series with this slug already exists')
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
      num_chapters: 0
    })
    .select('id, name, slug, picture_url')
    .single()

  if (error) {
    logger.error({ userId: user.id, slug, error }, 'Create series error')
    throw new DatabaseError('Failed to create series', error)
  }

  logger.info({ userId: user.id, seriesId: series.id, slug, name: series.name }, 'Series created successfully')

  return successResponse({ success: true, series })
}

/**
 * Generate URL-safe slug from title.
 * Input: title string
 * Output: slug string
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export const POST = withErrorHandler(handler)
