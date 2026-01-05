import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Tables } from '@/types/database.types'

type DbClient = SupabaseClient<Database>

/**
 * Gets adjacent chapters (previous and next) for navigation.
 * Input: supabase client, series id, current chapter number
 * Output: Object with prev and next chapter data (or null)
 */
export async function getAdjacentChapters(
  supabase: DbClient,
  seriesId: string,
  chapterNumber: number
): Promise<{
  prev: Tables<'chapters'> | null
  next: Tables<'chapters'> | null
}> {
  // Get previous chapter (highest chapter number less than current)
  const { data: prevData, error: prevError } = await supabase
    .from('chapters')
    .select('*')
    .eq('series_id', seriesId)
    .lt('chapter_number', chapterNumber)
    .order('chapter_number', { ascending: false })
    .limit(1)
    .single()

  // Get next chapter (lowest chapter number greater than current)
  const { data: nextData, error: nextError } = await supabase
    .from('chapters')
    .select('*')
    .eq('series_id', seriesId)
    .gt('chapter_number', chapterNumber)
    .order('chapter_number', { ascending: true })
    .limit(1)
    .single()

  // Handle errors - if no previous/next chapter, that's fine (not an error)
  const prev = prevError?.code === 'PGRST116' ? null : (prevData || null)
  const next = nextError?.code === 'PGRST116' ? null : (nextData || null)

  // Throw if there are actual errors (not just no rows)
  if (prevError && prevError.code !== 'PGRST116') throw prevError
  if (nextError && nextError.code !== 'PGRST116') throw nextError

  return { prev, next }
}

