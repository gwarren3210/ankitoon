import { createClient } from '@/lib/supabase/server'

export type ChapterVocabularyRow = {
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
 * Input: chapter id
 * Output: Array of chapter vocabulary rows ordered by importance
 */
export async function getChapterVocabulary(
  chapterId: string
): Promise<ChapterVocabularyRow[]> {
  const supabase = await createClient()
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

  // Supabase returns the relation as an array, but it's a one-to-one
  // relationship, so we take the first item
  return (data || []).map(row => ({
    vocabulary_id: row.vocabulary_id,
    importance_score: row.importance_score,
    example: row.example,
    vocabulary: Array.isArray(row.vocabulary)
      ? row.vocabulary[0] || null
      : row.vocabulary
  }))
}

/**
 * Gets vocabulary counts for a single chapter.
 * Input: chapter id
 * Output: Number of vocabulary entries
 */
export async function getChapterVocabularyCount(
  chapterId: string
): Promise<number> {
  const supabase = await createClient()
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
 * Input: array of chapter ids
 * Output: Map of chapter id to vocabulary count
 */
export async function getChapterVocabularyCountsBatch(
  chapterIds: string[]
): Promise<Map<string, number>> {
  if (chapterIds.length === 0) {
    return new Map()
  }

  const supabase = await createClient()
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
 * Input: array of chapter ids
 * Output: Array of vocabulary with chapter ids for aggregation
 */
export async function getChapterVocabularyStatsBatch(
  chapterIds: string[]
): Promise<{
  chapterId: string
  importanceScore: number
  term: string
}[]> {
  if (chapterIds.length === 0) {
    return []
  }

  const supabase = await createClient()
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

  // Supabase returns the relation as an array, extract the first item
  return (data || []).map(item => {
    const vocab = Array.isArray(item.vocabulary)
      ? item.vocabulary[0]
      : item.vocabulary
    return {
      chapterId: item.chapter_id,
      importanceScore: item.importance_score,
      term: vocab?.term || ''
    }
  })
}
