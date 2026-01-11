import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Tables } from '@/types/database.types'

type DbClient = SupabaseClient<Database>

type ChapterVocabularyRow = {
  vocabulary_id: string
  importance_score: number
  example: string | null
  vocabulary: {
    id: string
    term: string
    definition: string
    example: string | null
    sense_key: string
  } | null
}

/**
 * Gets chapter_vocabulary rows with full vocabulary details.
 * Input: supabase client, chapter id
 * Output: Array of chapter vocabulary rows ordered by importance
 */
export async function getChapterVocabulary(
  supabase: DbClient,
  chapterId: string
): Promise<ChapterVocabularyRow[]> {
  const { data, error } = await supabase
    .from('chapter_vocabulary')
    .select(`
      vocabulary_id,
      importance_score,
      example,
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

  return (data || []) as ChapterVocabularyRow[]
}

/**
 * Gets vocabulary counts for a single chapter.
 * Input: supabase client, chapter id
 * Output: Number of vocabulary entries
 */
export async function getChapterVocabularyCount(
  supabase: DbClient,
  chapterId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('chapter_vocabulary')
    .select('vocabulary_id', { count: 'exact', head: true })
    .eq('chapter_id', chapterId)

  if (error) {
    throw error
  }

  return count || 0
}

/**
 * Gets vocabulary counts for multiple chapters in batch.
 * Input: supabase client, array of chapter ids
 * Output: Map of chapter id to vocabulary count
 */
export async function getChapterVocabularyCountsBatch(
  supabase: DbClient,
  chapterIds: string[]
): Promise<Map<string, number>> {
  if (chapterIds.length === 0) {
    return new Map()
  }

  const { data, error } = await supabase
    .from('chapter_vocabulary')
    .select('chapter_id')
    .in('chapter_id', chapterIds)

  if (error) {
    throw error
  }

  const countMap = new Map<string, number>()
  for (const chapterId of chapterIds) {
    countMap.set(chapterId, 0)
  }

  for (const row of data || []) {
    const current = countMap.get(row.chapter_id) || 0
    countMap.set(row.chapter_id, current + 1)
  }

  return countMap
}

/**
 * Gets vocabulary statistics for multiple chapters in batch.
 * Input: supabase client, array of chapter ids
 * Output: Array of vocabulary with chapter ids for aggregation
 */
export async function getChapterVocabularyStatsBatch(
  supabase: DbClient,
  chapterIds: string[]
): Promise<{
  chapterId: string
  importanceScore: number
  term: string
}[]> {
  if (chapterIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('chapter_vocabulary')
    .select(`
      chapter_id,
      importance_score,
      vocabulary!inner(term)
    `)
    .in('chapter_id', chapterIds)

  if (error) {
    throw error
  }

  return (data || []).map(item => ({
    chapterId: item.chapter_id,
    importanceScore: item.importance_score,
    term: (item.vocabulary as Tables<'vocabulary'>)?.term || ''
  }))
}
