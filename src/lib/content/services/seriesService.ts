import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Tables } from '@/types/database.types'
import { VocabStats } from '@/types/series.types'
import { logger } from '@/lib/logger'
import {
  getSeriesBySlug,
  getAllSeries as getAllSeriesQuery,
  getSeriesBatch
} from '@/lib/content/queries/seriesQueries'
import {
  getChaptersBySeriesId,
  getChaptersBySeriesIdBatch,
  getChapterCountsBatch
} from '@/lib/content/queries/chapterQueries'
import {
  getChapterVocabularyStatsBatch
} from '@/lib/content/queries/vocabularyQueries'

type DbClient = SupabaseClient<Database>

/**
 * Gets series by slug with chapter count.
 * Input: supabase client, series slug
 * Output: Series data with num_chapters or null
 */
export async function getSeriesWithChapterCount(
  supabase: DbClient,
  slug: string
): Promise<(Tables<'series'> & { num_chapters: number }) | null> {
  const series = await getSeriesBySlug(supabase, slug)

  if (!series) {
    return null
  }

  const chapters = await getChaptersBySeriesId(supabase, series.id)

  return {
    ...series,
    num_chapters: chapters.length
  }
}

/**
 * Gets all series with chapter counts.
 * Input: supabase client
 * Output: Array of series with num_chapters
 */
export async function getAllSeriesWithChapterCounts(
  supabase: DbClient
): Promise<(Tables<'series'> & { num_chapters: number })[]> {
  const series = await getAllSeriesQuery(supabase)

  if (series.length === 0) {
    return []
  }

  const seriesIds = series.map(s => s.id)
  const chapterCounts = await getChapterCountsBatch(supabase, seriesIds)

  return series.map(s => ({
    ...s,
    num_chapters: chapterCounts.get(s.id) || 0
  }))
}

/**
 * Gets vocabulary statistics for a series.
 * Input: supabase client, series id
 * Output: Vocabulary statistics (total, unique, avg importance)
 */
export async function getSeriesVocabularyStats(
  supabase: DbClient,
  seriesId: string
): Promise<VocabStats> {
  const chapters = await getChaptersBySeriesId(supabase, seriesId)

  if (chapters.length === 0) {
    return {
      totalVocabulary: 0,
      uniqueTerms: 0,
      averageImportance: 0
    }
  }

  const chapterIds = chapters.map(ch => ch.id)
  const vocabStats = await getChapterVocabularyStatsBatch(supabase, chapterIds)

  const totalVocabulary = vocabStats.length
  const uniqueTerms = new Set(vocabStats.map(v => v.term)).size
  const averageImportance = vocabStats.length > 0
    ? vocabStats.reduce((sum, v) => sum + v.importanceScore, 0) / vocabStats.length
    : 0

  return {
    totalVocabulary,
    uniqueTerms,
    averageImportance: Math.round(averageImportance * 100) / 100
  }
}

/**
 * Gets vocabulary statistics for multiple series in batch.
 * Input: supabase client, array of series ids
 * Output: Map of series id to vocabulary statistics
 */
export async function getSeriesVocabularyStatsBatch(
  supabase: DbClient,
  seriesIds: string[]
): Promise<Map<string, VocabStats>> {
  if (seriesIds.length === 0) {
    return new Map()
  }

  const statsMap = new Map<string, VocabStats>()

  const seriesBatch = await getSeriesBatch(supabase, seriesIds)
  const chaptersBatch = await getChaptersBySeriesIdBatch(supabase, seriesIds)
  const chapterIds: string[] = []
  const chapterToSeriesMap = new Map<string, string>()

  for (const seriesId of seriesIds) {
    const series = seriesBatch.get(seriesId)
    if (!series) {
      statsMap.set(seriesId, {
        totalVocabulary: 0,
        uniqueTerms: 0,
        averageImportance: 0
      })
      continue
    }

    const chapters = chaptersBatch.get(seriesId) || []
    for (const chapter of chapters) {
      chapterIds.push(chapter.id)
      chapterToSeriesMap.set(chapter.id, seriesId)
    }
  }

  if (chapterIds.length === 0) {
    for (const seriesId of seriesIds) {
      if (!statsMap.has(seriesId)) {
        statsMap.set(seriesId, {
          totalVocabulary: 0,
          uniqueTerms: 0,
          averageImportance: 0
        })
      }
    }
    return statsMap
  }

  const vocabStats = await getChapterVocabularyStatsBatch(supabase, chapterIds)

  const seriesVocabMap = new Map<string, { importanceScore: number, term: string }[]>()
  for (const stat of vocabStats) {
    const seriesId = chapterToSeriesMap.get(stat.chapterId)
    if (!seriesId) continue

    if (!seriesVocabMap.has(seriesId)) {
      seriesVocabMap.set(seriesId, [])
    }
    seriesVocabMap.get(seriesId)!.push({
      importanceScore: stat.importanceScore,
      term: stat.term
    })
  }

  for (const seriesId of seriesIds) {
    const vocabItems = seriesVocabMap.get(seriesId) || []
    const totalVocabulary = vocabItems.length
    const uniqueTerms = new Set(vocabItems.map(v => v.term)).size
    const averageImportance = vocabItems.length > 0
      ? vocabItems.reduce((sum, v) => sum + v.importanceScore, 0) / vocabItems.length
      : 0

    statsMap.set(seriesId, {
      totalVocabulary,
      uniqueTerms,
      averageImportance: Math.round(averageImportance * 100) / 100
    })
  }

  return statsMap
}
