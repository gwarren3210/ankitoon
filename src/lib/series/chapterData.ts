import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Tables } from '@/types/database.types'
import { ChapterVocabulary } from '@/types/series.types'

type DbClient = SupabaseClient<Database>

type ChapterVocabularyRow = {
  vocabulary_id: string
  importance_score: number
  vocabulary: {
    id: string
    term: string
    definition: string
    example: string | null
    sense_key: string
  } | null
}

/**
 * Gets chapter by series ID and chapter number.
 * Input: supabase client, series id, chapter number
 * Output: Chapter data or null
 */
export async function getChapterByNumber(
  supabase: DbClient,
  seriesId: string,
  chapterNumber: number
): Promise<Tables<'chapters'> | null> {
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('series_id', seriesId)
    .eq('chapter_number', chapterNumber)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null
    }
    throw error
  }

  return data
}

/**
 * Gets vocabulary for a chapter with full vocabulary details.
 * Input: supabase client, chapter id
 * Output: Array of chapter vocabulary with full details
 */
export async function getChapterVocabulary(
  supabase: DbClient,
  chapterId: string
): Promise<ChapterVocabulary[]> {
  const { data, error } = await supabase
    .from('chapter_vocabulary')
    .select(`
      vocabulary_id,
      importance_score,
      vocabulary (
        id,
        term,
        definition,
        example,
        sense_key
      )
    `)
    .eq('chapter_id', chapterId)
    .order('importance_score', { ascending: false })

  if (error) {
    throw error
  }

  return (data || []).map((item: ChapterVocabularyRow) => {
    const vocab = item.vocabulary
    return {
      vocabularyId: item.vocabulary_id,
      term: vocab?.term || '',
      definition: vocab?.definition || '',
      senseKey: vocab?.sense_key || '',
      example: vocab?.example || null,
      importanceScore: item.importance_score
    }
  })
}

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
