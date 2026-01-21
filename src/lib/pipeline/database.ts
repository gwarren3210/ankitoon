/**
 * Database service for pipeline vocabulary, grammar, and chapter operations.
 *
 * FILE OUTLINE:
 * =============
 *
 * EXPORTED FUNCTIONS:
 * - getOrCreateChapter() - Gets or creates chapter by series slug/number
 * - storeChapterVocabulary() - Batch stores vocabulary for chapter
 * - storeChapterGrammar() - Batch stores grammar patterns for chapter
 *
 * TYPE DEFINITIONS:
 * - StoreResult - Return type for storeChapterVocabulary()
 * - GrammarStoreResult - Return type for storeChapterGrammar()
 *
 * VOCABULARY HELPERS (private):
 * - vocabKey() - Creates unique key from term::sense_key
 * - findExistingVocabulary() - Batch query to find existing vocabulary
 * - batchInsertVocabulary() - Batch insert new vocabulary entries
 * - getVocabularyIds() - Batch query to get vocabulary IDs
 * - batchLinkToChapter() - Batch upsert chapter-vocabulary links
 *
 * GRAMMAR HELPERS (private):
 * - grammarKey() - Creates unique key from pattern::sense_key
 * - findExistingGrammar() - Batch query to find existing grammar
 * - batchInsertGrammar() - Batch insert new grammar patterns
 * - getGrammarIds() - Batch query to get grammar IDs
 * - batchLinkGrammarToChapter() - Batch upsert chapter-grammar links
 *
 * PERFORMANCE: O(1) - All operations use batch queries (5 DB calls per type)
 */

import { createServiceRoleClient } from '@/lib/supabase/server'
import { ExtractedWord, ExtractedGrammar } from '@/lib/pipeline/types'
import { logger } from '@/lib/logger'

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
 * Input: series slug, chapter number, optional title, optional external url
 * Output: chapter id
 */
export async function getOrCreateChapter(
  seriesSlug: string,
  chapterNumber: number,
  title?: string,
  externalUrl?: string
): Promise<string> {
  const supabase = createServiceRoleClient()
  logger.debug({ seriesSlug, chapterNumber, title, externalUrl }, 'Getting or creating chapter')

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
    .select('id, external_url')
    .eq('series_id', series.id)
    .eq('chapter_number', chapterNumber)
    .single()

  if (existing) {
    logger.debug({ chapterId: existing.id }, 'Chapter already exists')
    if (externalUrl && existing.external_url !== externalUrl) {
      const { error: updateError } = await supabase
        .from('chapters')
        .update({ external_url: externalUrl })
        .eq('id', existing.id)

      if (updateError) {
        logger.warn({ error: updateError.message }, 'Failed to update external_url')
      } else {
        logger.debug({ chapterId: existing.id }, 'Updated external_url')
      }
    }
    return existing.id
  }

  const { data, error } = await supabase
    .from('chapters')
    .insert({
      series_id: series.id,
      chapter_number: chapterNumber,
      title: title || `Chapter ${chapterNumber}`,
      external_url: externalUrl || null
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
 * Input: words array, series slug, chapter number, title, external url
 * Output: store result with counts
 */
export async function storeChapterVocabulary(
  words: ExtractedWord[],
  seriesSlug: string,
  chapterNumber: number,
  chapterTitle?: string,
  chapterLink?: string
): Promise<StoreResult> {
  logger.info({
    wordCount: words.length,
    seriesSlug,
    chapterNumber
  }, 'Storing chapter vocabulary')

  if (words.length === 0) {
    logger.debug('No words to store')
    const chapterId = await getOrCreateChapter(
      seriesSlug,
      chapterNumber,
      chapterTitle,
      chapterLink
    )
    return { newWordsInserted: 0, totalWordsInChapter: 0, chapterId }
  }

  const chapterId = await getOrCreateChapter(
    seriesSlug,
    chapterNumber,
    chapterTitle,
    chapterLink
  )

  logger.debug('Finding existing vocabulary')
  const existingIds = await findExistingVocabulary(words)
  const newWords = words.filter(w => !existingIds.has(vocabKey(w)))
  logger.debug({
    totalWords: words.length,
    existingCount: existingIds.size,
    newWordCount: newWords.length
  }, 'Identified new vs existing words')

  const newWordsInserted = await batchInsertVocabulary(newWords)
  logger.debug('Getting vocabulary IDs')
  const allVocabIds = await getVocabularyIds(words)
  logger.debug('Linking vocabulary to chapter')
  await batchLinkToChapter(chapterId, words, allVocabIds)

  const supabase = createServiceRoleClient()
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
 * Input: words array
 * Output: set of existing vocab keys
 */
async function findExistingVocabulary(
  words: ExtractedWord[]
): Promise<Set<string>> {
  const supabase = createServiceRoleClient()
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
 * Input: new words to insert
 * Output: count of inserted words
 */
async function batchInsertVocabulary(
  words: ExtractedWord[]
): Promise<number> {
  if (words.length === 0) {
    logger.debug('No words to insert')
    return 0
  }

  const supabase = createServiceRoleClient()
  logger.debug({ wordCount: words.length }, 'Batch inserting vocabulary')
  const rows = words.map(w => ({
    term: w.korean,
    definition: w.english,
    sense_key: w.senseKey,
    example: w.globalExample || null
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
 * Input: words array
 * Output: map of vocab key to id
 */
async function getVocabularyIds(
  words: ExtractedWord[]
): Promise<Map<string, string>> {
  const supabase = createServiceRoleClient()
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
 * Input: chapter id, words, vocab id map
 * Output: void
 */
async function batchLinkToChapter(
  chapterId: string,
  words: ExtractedWord[],
  vocabIds: Map<string, string>
): Promise<void> {
  const supabase = createServiceRoleClient()
  logger.debug({ chapterId, wordCount: words.length }, 'Linking vocabulary to chapter')

  const rows = words
    .map(w => {
      const vocabId = vocabIds.get(vocabKey(w))
      if (!vocabId) return null
      return {
        chapter_id: chapterId,
        vocabulary_id: vocabId,
        importance_score: w.importanceScore,
        example: w.chapterExample || null
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

// ============================================================================
// GRAMMAR STORAGE FUNCTIONS
// ============================================================================

/**
 * Result of storing grammar for a chapter.
 */
export type GrammarStoreResult = {
  newGrammarInserted: number
  totalGrammarInChapter: number
  chapterId: string
}

/**
 * Stores all extracted grammar patterns for a chapter using batch operations.
 * 1. Batch upsert grammar patterns
 * 2. Batch link to chapter
 * Input: grammar array, series slug, chapter number, title, external url
 * Output: store result with counts
 */
export async function storeChapterGrammar(
  grammar: ExtractedGrammar[],
  seriesSlug: string,
  chapterNumber: number,
  chapterTitle?: string,
  chapterLink?: string
): Promise<GrammarStoreResult> {
  logger.info({
    grammarCount: grammar.length,
    seriesSlug,
    chapterNumber
  }, 'Storing chapter grammar')

  if (grammar.length === 0) {
    logger.debug('No grammar to store')
    const chapterId = await getOrCreateChapter(
      seriesSlug,
      chapterNumber,
      chapterTitle,
      chapterLink
    )
    return { newGrammarInserted: 0, totalGrammarInChapter: 0, chapterId }
  }

  const chapterId = await getOrCreateChapter(
    seriesSlug,
    chapterNumber,
    chapterTitle,
    chapterLink
  )

  logger.debug('Finding existing grammar')
  const existingIds = await findExistingGrammar(grammar)
  const newGrammar = grammar.filter(g => !existingIds.has(grammarKey(g)))
  logger.debug({
    totalGrammar: grammar.length,
    existingCount: existingIds.size,
    newGrammarCount: newGrammar.length
  }, 'Identified new vs existing grammar')

  const newGrammarInserted = await batchInsertGrammar(newGrammar)
  logger.debug('Getting grammar IDs')
  const allGrammarIds = await getGrammarIds(grammar)
  logger.debug('Linking grammar to chapter')
  await batchLinkGrammarToChapter(chapterId, grammar, allGrammarIds)

  const supabase = createServiceRoleClient()
  const { count } = await supabase
    .from('chapter_grammar')
    .select('*', { count: 'exact', head: true })
    .eq('chapter_id', chapterId)

  const result = {
    newGrammarInserted,
    totalGrammarInChapter: count || grammar.length,
    chapterId
  }

  logger.info({
    newGrammarInserted: result.newGrammarInserted,
    totalGrammarInChapter: result.totalGrammarInChapter
  }, 'Chapter grammar stored successfully')

  return result
}

/**
 * Creates lookup key for grammar deduplication.
 * Input: extracted grammar
 * Output: unique key string
 */
function grammarKey(g: ExtractedGrammar): string {
  return `${g.korean}::${g.senseKey}`
}

/**
 * Finds existing grammar entries matching patterns.
 * Input: grammar array
 * Output: set of existing grammar keys
 */
async function findExistingGrammar(
  grammar: ExtractedGrammar[]
): Promise<Set<string>> {
  const supabase = createServiceRoleClient()
  const patterns = [...new Set(grammar.map(g => g.korean))]
  logger.debug({ uniquePatternCount: patterns.length }, 'Finding existing grammar')

  const { data } = await supabase
    .from('grammar')
    .select('pattern, sense_key')
    .in('pattern', patterns)

  const existing = new Set<string>()
  for (const row of data || []) {
    existing.add(`${row.pattern}::${row.sense_key}`)
  }

  logger.debug({ existingCount: existing.size }, 'Found existing grammar')
  return existing
}

/**
 * Batch inserts new grammar entries.
 * Input: new grammar to insert
 * Output: count of inserted grammar
 */
async function batchInsertGrammar(
  grammar: ExtractedGrammar[]
): Promise<number> {
  if (grammar.length === 0) {
    logger.debug('No grammar to insert')
    return 0
  }

  const supabase = createServiceRoleClient()
  logger.debug({ grammarCount: grammar.length }, 'Batch inserting grammar')
  const rows = grammar.map(g => ({
    pattern: g.korean,
    definition: g.english,
    sense_key: g.senseKey,
    example: g.globalExample || null
  }))

  const { error } = await supabase
    .from('grammar')
    .insert(rows)

  if (error) {
    logger.error({ error: error.message }, 'Failed to batch insert grammar')
    throw new Error(`Failed to batch insert grammar: ${error.message}`)
  }

  logger.info({ insertedCount: grammar.length }, 'Grammar batch insert completed')
  return grammar.length
}

/**
 * Gets grammar IDs for all patterns.
 * Input: grammar array
 * Output: map of grammar key to id
 */
async function getGrammarIds(
  grammar: ExtractedGrammar[]
): Promise<Map<string, string>> {
  const supabase = createServiceRoleClient()
  const patterns = [...new Set(grammar.map(g => g.korean))]
  logger.debug({ uniquePatternCount: patterns.length }, 'Getting grammar IDs')

  const { data, error } = await supabase
    .from('grammar')
    .select('id, pattern, sense_key')
    .in('pattern', patterns)

  if (error) {
    logger.error({ error: error.message }, 'Failed to fetch grammar IDs')
    throw new Error(`Failed to fetch grammar IDs: ${error.message}`)
  }

  const idMap = new Map<string, string>()
  for (const row of data || []) {
    idMap.set(`${row.pattern}::${row.sense_key}`, row.id)
  }

  logger.debug({ idMapSize: idMap.size }, 'Grammar IDs retrieved')
  return idMap
}

/**
 * Batch links grammar to chapter.
 * Input: chapter id, grammar, grammar id map
 * Output: void
 */
async function batchLinkGrammarToChapter(
  chapterId: string,
  grammar: ExtractedGrammar[],
  grammarIds: Map<string, string>
): Promise<void> {
  const supabase = createServiceRoleClient()
  logger.debug(
    { chapterId, grammarCount: grammar.length },
    'Linking grammar to chapter'
  )

  const rows = grammar
    .map(g => {
      const gId = grammarIds.get(grammarKey(g))
      if (!gId) return null
      return {
        chapter_id: chapterId,
        grammar_id: gId,
        importance_score: g.importanceScore,
        example: g.chapterExample || null
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  if (rows.length === 0) {
    logger.warn('No grammar links to create')
    return
  }

  logger.debug(
    { linkCount: rows.length },
    'Batch upserting chapter-grammar links'
  )
  const { error } = await supabase
    .from('chapter_grammar')
    .upsert(rows, { onConflict: 'chapter_id,grammar_id' })

  if (error) {
    logger.error({ error: error.message }, 'Failed to batch link grammar')
    throw new Error(`Failed to batch link grammar: ${error.message}`)
  }

  logger.info({ linkCount: rows.length }, 'Grammar linked to chapter')
}
