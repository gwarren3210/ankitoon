import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Tables } from '@/types/database.types'
import { VocabStats } from '@/types/series.types'

type DbClient = SupabaseClient<Database>

/**
 * Gets series by slug with dynamically calculated chapter count.
 * Input: supabase client, series slug
 * Output: Series data with calculated num_chapters or null
 */
export async function getSeriesBySlug(
  supabase: DbClient,
  slug: string
): Promise<(Tables<'series'> & { num_chapters: number }) | null> {
  const { data, error } = await supabase
    .from('series')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null
    }
    throw error
  }

  if (!data) {
    return null
  }

  // Calculate chapter count dynamically
  const { count, error: countError } = await supabase
    .from('chapters')
    .select('id', { count: 'exact', head: true })
    .eq('series_id', data.id)

  if (countError) {
    throw countError
  }

  return {
    ...data,
    num_chapters: count || 0
  }
}

/**
 * Gets all chapters for a series ordered by chapter number.
 * Input: supabase client, series id
 * Output: Array of chapter data
 */
export async function getSeriesChapters(
  supabase: DbClient,
  seriesId: string
): Promise<Tables<'chapters'>[]> {
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('series_id', seriesId)
    .order('chapter_number', { ascending: true })

  if (error) {
    throw error
  }

  return data || []
}

/**
 * Gets vocabulary statistics for a series.
 * Input: supabase client, series id
 * Output: Vocabulary statistics
 */
export async function getSeriesVocabStats(
  supabase: DbClient,
  seriesId: string
): Promise<VocabStats> {
  // Get all chapter IDs for the series
  const { data: chapterIds, error: chaptersError } = await supabase
    .from('chapters')
    .select('id')
    .eq('series_id', seriesId)

  if (chaptersError) {
    throw chaptersError
  }

  if (!chapterIds || chapterIds.length === 0) {
    return {
      totalVocabulary: 0,
      uniqueTerms: 0,
      averageImportance: 0
    }
  }

  const chapterIdList = chapterIds.map(ch => ch.id)

  // Get vocabulary statistics
  const { data: vocabStats, error: vocabError } = await supabase
    .from('chapter_vocabulary')
    .select(`
      importance_score,
      vocabulary!inner(term)
    `)
    .in('chapter_id', chapterIdList)

  if (vocabError) {
    throw vocabError
  }

  const vocabItems = vocabStats || []
  const totalVocabulary = vocabItems.length
  const uniqueTerms = new Set(vocabItems.map(item =>
    (item.vocabulary as Tables<'vocabulary'>)?.term
  )).size
  const averageImportance = vocabItems.length > 0
    ? vocabItems.reduce((sum, item) => sum + item.importance_score, 0) / vocabItems.length
    : 0

  return {
    totalVocabulary,
    uniqueTerms,
    averageImportance: Math.round(averageImportance * 100) / 100
  }
}

/**
 * Gets all series ordered by name with dynamically calculated chapter counts.
 * Input: supabase client
 * Output: Array of all series with calculated num_chapters
 */
export async function getAllSeries(
  supabase: DbClient
): Promise<(Tables<'series'> & { num_chapters: number })[]> {
  const { data, error } = await supabase
    .from('series')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    throw error
  }

  if (!data || data.length === 0) {
    return []
  }

  // Get all series IDs
  const seriesIds = data.map(s => s.id)

  // Count chapters for each series
  const { data: chapterCounts, error: countError } = await supabase
    .from('chapters')
    .select('series_id')
    .in('series_id', seriesIds)

  if (countError) {
    throw countError
  }

  // Create a map of series_id to chapter count
  const chapterCountMap = new Map<string, number>()
  for (const chapter of chapterCounts || []) {
    const current = chapterCountMap.get(chapter.series_id) || 0
    chapterCountMap.set(chapter.series_id, current + 1)
  }

  // Add calculated num_chapters to each series
  return data.map(series => ({
    ...series,
    num_chapters: chapterCountMap.get(series.id) || 0
  }))
}

/**
 * Gets vocabulary stats for multiple series in batch.
 * Input: supabase client, array of series ids
 * Output: Map of series id to vocabulary stats
 */
export async function getSeriesStatsBatch(
  supabase: DbClient,
  seriesIds: string[]
): Promise<Map<string, VocabStats>> {
  if (seriesIds.length === 0) {
    return new Map()
  }

  const statsMap = new Map<string, VocabStats>()

  // Get all chapters for these series
  const { data: chapters, error: chaptersError } = await supabase
    .from('chapters')
    .select('id, series_id')
    .in('series_id', seriesIds)

  if (chaptersError) {
    throw chaptersError
  }

  if (!chapters || chapters.length === 0) {
    // No chapters, return empty stats for all series
    for (const seriesId of seriesIds) {
      statsMap.set(seriesId, {
        totalVocabulary: 0,
        uniqueTerms: 0,
        averageImportance: 0
      })
    }
    return statsMap
  }

  const chapterIds = chapters.map(ch => ch.id)
  const chapterToSeriesMap = new Map<string, string>()
  for (const chapter of chapters) {
    chapterToSeriesMap.set(chapter.id, chapter.series_id)
  }

  // Get vocabulary statistics for all chapters
  const { data: vocabStats, error: vocabError } = await supabase
    .from('chapter_vocabulary')
    .select(`
      chapter_id,
      importance_score,
      vocabulary!inner(term)
    `)
    .in('chapter_id', chapterIds)

  if (vocabError) {
    throw vocabError
  }

  // Group by series
  const seriesVocabMap = new Map<string, Array<{ importance_score: number, term: string }>>()
  for (const item of vocabStats || []) {
    const seriesId = chapterToSeriesMap.get(item.chapter_id)
    if (!seriesId) continue

    if (!seriesVocabMap.has(seriesId)) {
      seriesVocabMap.set(seriesId, [])
    }
    seriesVocabMap.get(seriesId)!.push({
      importance_score: item.importance_score,
      term: (item.vocabulary as Tables<'vocabulary'>)?.term || ''
    })
  }

  // Calculate stats for each series
  for (const seriesId of seriesIds) {
    const vocabItems = seriesVocabMap.get(seriesId) || []
    const totalVocabulary = vocabItems.length
    const uniqueTerms = new Set(vocabItems.map(item => item.term)).size
    const averageImportance = vocabItems.length > 0
      ? vocabItems.reduce((sum, item) => sum + item.importance_score, 0) / vocabItems.length
      : 0

    statsMap.set(seriesId, {
      totalVocabulary,
      uniqueTerms,
      averageImportance: Math.round(averageImportance * 100) / 100
    })
  }

  return statsMap
}

/**
 * Gets vocabulary counts for multiple chapters in batch.
 * Input: supabase client, array of chapter ids
 * Output: Map of chapter id to vocabulary count
 */
export async function getChapterVocabCountsBatch(
  supabase: DbClient,
  chapterIds: string[]
): Promise<Map<string, number>> {
  if (chapterIds.length === 0) {
    return new Map()
  }

  // Single query to get all chapter_vocabulary rows for these chapters
  const { data, error } = await supabase
    .from('chapter_vocabulary')
    .select('chapter_id')
    .in('chapter_id', chapterIds)

  if (error) {
    throw error
  }

  // Count occurrences per chapter
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
