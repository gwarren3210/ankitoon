/**
 * Database service for pipeline vocabulary and chapter operations.
 * 
 * FILE OUTLINE:
 * =============
 * 
 * EXPORTED FUNCTIONS:
 * - getOrCreateChapter() - Gets or creates chapter by series slug/number
 * - storeChapterVocabulary() - Main orchestrator: batch stores vocabulary for chapter
 * 
 * TYPE DEFINITIONS:
 * - StoreResult - Return type for storeChapterVocabulary()
 * - DbClient - Type alias for Supabase client
 * 
 * HELPER FUNCTIONS (private):
 * - vocabKey() - Creates unique key from term::sense_key
 * - findExistingVocabulary() - Batch query to find existing vocabulary entries
 * - batchInsertVocabulary() - Batch insert new vocabulary entries
 * - getVocabularyIds() - Batch query to get vocabulary IDs
 * - batchLinkToChapter() - Batch upsert chapter-vocabulary links
 * 
 * PERFORMANCE: O(1) - All operations use batch queries (5 DB calls total)
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { ExtractedWord } from '@/lib/pipeline/types'
import { logger } from '@/lib/logger'

type DbClient = SupabaseClient<Database>

/**
 * Result of storing vocabulary for a chapter.
 */
export type StoreResult = {
  newWordsInserted: number
  totalWordsInChapter: number
  chapterId: string
}

/**
 * Gets or creates chapter by series slug and chapter number.
 * Input: supabase client, series slug, chapter number, optional title
 * Output: chapter id
 */
export async function getOrCreateChapter(
  supabase: DbClient,
  seriesSlug: string,
  chapterNumber: number,
  title?: string
): Promise<string> {
  logger.debug({ seriesSlug, chapterNumber, title }, 'Getting or creating chapter')

  const { data: series } = await supabase
    .from('series')
    .select('id')
    .eq('slug', seriesSlug)
    .single()

  if (!series) {
    logger.error({ seriesSlug }, 'Series not found')
    throw new Error(`Series not found: ${seriesSlug}`)
  }

  const { data: existing } = await supabase
    .from('chapters')
    .select('id')
    .eq('series_id', series.id)
    .eq('chapter_number', chapterNumber)
    .single()

  if (existing) {
    logger.debug({ chapterId: existing.id }, 'Chapter already exists')
    return existing.id
  }

  const { data, error } = await supabase
    .from('chapters')
    .insert({
      series_id: series.id,
      chapter_number: chapterNumber,
      title: title || `Chapter ${chapterNumber}`
    })
    .select('id')
    .single()

  if (error) {
    logger.error({ error: error.message }, 'Failed to create chapter')
    throw new Error(`Failed to create chapter: ${error.message}`)
  }

  logger.info({ chapterId: data.id }, 'Chapter created')
  return data.id
}

/**
 * Stores all extracted words for a chapter using batch operations.
 * 1. Batch upsert vocabulary
 * 2. Batch link to chapter
 * Input: supabase client, words array, series slug, chapter number, title
 * Output: store result with counts
 */
export async function storeChapterVocabulary(
  supabase: DbClient,
  words: ExtractedWord[],
  seriesSlug: string,
  chapterNumber: number,
  chapterTitle?: string
): Promise<StoreResult> {
  logger.info({
    wordCount: words.length,
    seriesSlug,
    chapterNumber
  }, 'Storing chapter vocabulary')

  if (words.length === 0) {
    logger.debug('No words to store')
    const chapterId = await getOrCreateChapter(
      supabase,
      seriesSlug,
      chapterNumber,
      chapterTitle
    )
    return { newWordsInserted: 0, totalWordsInChapter: 0, chapterId }
  }

  const chapterId = await getOrCreateChapter(
    supabase,
    seriesSlug,
    chapterNumber,
    chapterTitle
  )

  logger.debug('Finding existing vocabulary')
  const existingIds = await findExistingVocabulary(supabase, words)
  const newWords = words.filter(w => !existingIds.has(vocabKey(w)))
  logger.debug({
    totalWords: words.length,
    existingCount: existingIds.size,
    newWordCount: newWords.length
  }, 'Identified new vs existing words')

  const newWordsInserted = await batchInsertVocabulary(supabase, newWords)
  logger.debug('Getting vocabulary IDs')
  const allVocabIds = await getVocabularyIds(supabase, words)
  logger.debug('Linking vocabulary to chapter')
  await batchLinkToChapter(supabase, chapterId, words, allVocabIds)

  const { count } = await supabase
    .from('chapter_vocabulary')
    .select('*', { count: 'exact', head: true })
    .eq('chapter_id', chapterId)

  const result = {
    newWordsInserted,
    totalWordsInChapter: count || words.length,
    chapterId
  }

  logger.info({
    newWordsInserted: result.newWordsInserted,
    totalWordsInChapter: result.totalWordsInChapter
  }, 'Chapter vocabulary stored successfully')

  return result
}

/**
 * Creates lookup key for vocabulary deduplication.
 * Input: extracted word
 * Output: unique key string
 */
function vocabKey(word: ExtractedWord): string {
  return `${word.korean}::${word.senseKey}`
}

/**
 * Finds existing vocabulary entries matching words.
 * Input: supabase client, words array
 * Output: set of existing vocab keys
 */
async function findExistingVocabulary(
  supabase: DbClient,
  words: ExtractedWord[]
): Promise<Set<string>> {
  const terms = [...new Set(words.map(w => w.korean))]
  logger.debug({ uniqueTermCount: terms.length }, 'Finding existing vocabulary')

  const { data } = await supabase
    .from('vocabulary')
    .select('term, sense_key')
    .in('term', terms)

  const existing = new Set<string>()
  for (const row of data || []) {
    existing.add(`${row.term}::${row.sense_key}`)
  }

  logger.debug({ existingCount: existing.size }, 'Found existing vocabulary')
  return existing
}

/**
 * Batch inserts new vocabulary entries.
 * Input: supabase client, new words to insert
 * Output: count of inserted words
 */
async function batchInsertVocabulary(
  supabase: DbClient,
  words: ExtractedWord[]
): Promise<number> {
  if (words.length === 0) {
    logger.debug('No words to insert')
    return 0
  }

  logger.debug({ wordCount: words.length }, 'Batch inserting vocabulary')
  const rows = words.map(w => ({
    term: w.korean,
    definition: w.english,
    sense_key: w.senseKey
  }))

  const { error } = await supabase
    .from('vocabulary')
    .insert(rows)

  if (error) {
    logger.error({ error: error.message }, 'Failed to batch insert vocabulary')
    throw new Error(`Failed to batch insert vocabulary: ${error.message}`)
  }

  logger.info({ insertedCount: words.length }, 'Vocabulary batch insert completed')
  return words.length
}

/**
 * Gets vocabulary IDs for all words.
 * Input: supabase client, words array
 * Output: map of vocab key to id
 */
async function getVocabularyIds(
  supabase: DbClient,
  words: ExtractedWord[]
): Promise<Map<string, string>> {
  const terms = [...new Set(words.map(w => w.korean))]
  logger.debug({ uniqueTermCount: terms.length }, 'Getting vocabulary IDs')

  const { data, error } = await supabase
    .from('vocabulary')
    .select('id, term, sense_key')
    .in('term', terms)

  if (error) {
    logger.error({ error: error.message }, 'Failed to fetch vocabulary IDs')
    throw new Error(`Failed to fetch vocabulary IDs: ${error.message}`)
  }

  const idMap = new Map<string, string>()
  for (const row of data || []) {
    idMap.set(`${row.term}::${row.sense_key}`, row.id)
  }

  logger.debug({ idMapSize: idMap.size }, 'Vocabulary IDs retrieved')
  return idMap
}

/**
 * Batch links vocabulary to chapter.
 * Input: supabase client, chapter id, words, vocab id map
 * Output: void
 */
async function batchLinkToChapter(
  supabase: DbClient,
  chapterId: string,
  words: ExtractedWord[],
  vocabIds: Map<string, string>
): Promise<void> {
  logger.debug({ chapterId, wordCount: words.length }, 'Linking vocabulary to chapter')

  const rows = words
    .map(w => {
      const vocabId = vocabIds.get(vocabKey(w))
      if (!vocabId) return null
      return {
        chapter_id: chapterId,
        vocabulary_id: vocabId,
        importance_score: w.importanceScore
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  if (rows.length === 0) {
    logger.warn('No vocabulary links to create')
    return
  }

  logger.debug({ linkCount: rows.length }, 'Batch upserting chapter-vocabulary links')
  const { error } = await supabase
    .from('chapter_vocabulary')
    .upsert(rows, { onConflict: 'chapter_id,vocabulary_id' })

  if (error) {
    logger.error({ error: error.message }, 'Failed to batch link vocabulary')
    throw new Error(`Failed to batch link vocabulary: ${error.message}`)
  }

  logger.info({ linkCount: rows.length }, 'Vocabulary linked to chapter')
}
