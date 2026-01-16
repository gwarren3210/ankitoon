import { createClient } from '@/lib/supabase/server'
import { Database, TablesInsert } from '@/types/database.types'
import { logger } from '@/lib/logger'
import { createNewCard } from '@/lib/study/fsrs'

/**
 * Result of card initialization containing counts for both types.
 */
export type InitializationResult = {
  vocabularyCount: number
  grammarCount: number
  totalCount: number
}

/**
 * Initializes all vocabulary and grammar cards for a chapter (first time study).
 * Bulk inserts all cards with state 'New' for efficient initialization.
 * Input: user id, deck id, chapter id
 * Output: InitializationResult with counts for vocabulary and grammar
 */
export async function initializeChapterCards(
  userId: string,
  deckId: string,
  chapterId: string
): Promise<InitializationResult> {
  logger.debug({ userId, deckId, chapterId }, 'Initializing chapter cards')

  // Initialize vocabulary cards
  const vocabCount = await initializeVocabularyCards(userId, deckId, chapterId)

  // Initialize grammar cards
  const grammarCount = await initializeGrammarCards(userId, deckId, chapterId)

  const result: InitializationResult = {
    vocabularyCount: vocabCount,
    grammarCount: grammarCount,
    totalCount: vocabCount + grammarCount
  }

  logger.info({
    userId,
    deckId,
    chapterId,
    vocabularyCount: result.vocabularyCount,
    grammarCount: result.grammarCount,
    totalCount: result.totalCount
  }, 'Chapter cards initialized successfully')

  return result
}

/**
 * Initializes vocabulary cards for a chapter.
 * Input: user id, deck id, chapter id
 * Output: number of vocabulary cards initialized
 */
async function initializeVocabularyCards(
  userId: string,
  deckId: string,
  chapterId: string
): Promise<number> {
  const vocabularyIds = await getChapterVocabularyIds(chapterId)

  if (vocabularyIds.length === 0) {
    logger.debug({ userId, deckId, chapterId }, 'No vocabulary found for chapter')
    return 0
  }

  const existingIds = await getExistingCardVocabularyIds(userId, vocabularyIds)
  const newIds = vocabularyIds.filter(id => !existingIds.has(id))

  if (newIds.length === 0) {
    logger.debug({
      userId,
      deckId,
      chapterId,
      totalVocabulary: vocabularyIds.length,
      existingCount: existingIds.size
    }, 'All vocabulary cards already initialized')
    return 0
  }

  const cardsToInsert = buildVocabularyCardsToInsert(userId, deckId, newIds)
  await bulkInsertCards(cardsToInsert)

  logger.debug({
    userId,
    deckId,
    chapterId,
    cardCount: newIds.length
  }, 'Vocabulary cards initialized')
  return newIds.length
}

/**
 * Initializes grammar cards for a chapter.
 * Input: user id, deck id, chapter id
 * Output: number of grammar cards initialized
 */
async function initializeGrammarCards(
  userId: string,
  deckId: string,
  chapterId: string
): Promise<number> {
  const grammarIds = await getChapterGrammarIds(chapterId)

  if (grammarIds.length === 0) {
    logger.debug({ userId, deckId, chapterId }, 'No grammar found for chapter')
    return 0
  }

  const existingIds = await getExistingCardGrammarIds(userId, grammarIds)
  const newIds = grammarIds.filter(id => !existingIds.has(id))

  if (newIds.length === 0) {
    logger.debug({
      userId,
      deckId,
      chapterId,
      totalGrammar: grammarIds.length,
      existingCount: existingIds.size
    }, 'All grammar cards already initialized')
    return 0
  }

  const cardsToInsert = buildGrammarCardsToInsert(userId, deckId, newIds)
  await bulkInsertCards(cardsToInsert)

  logger.debug({
    userId,
    deckId,
    chapterId,
    cardCount: newIds.length
  }, 'Grammar cards initialized')
  return newIds.length
}

// ============================================================================
// VOCABULARY HELPERS
// ============================================================================

/**
 * Gets vocabulary IDs for a chapter.
 * Input: chapter id
 * Output: array of vocabulary IDs
 */
async function getChapterVocabularyIds(
  chapterId: string
): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('chapter_vocabulary')
    .select('vocabulary_id')
    .eq('chapter_id', chapterId)

  if (error) {
    logger.error({
      chapterId,
      error: error.message,
      code: error.code
    }, 'Error fetching chapter vocabulary for initialization')
    throw error
  }

  return data?.map(cv => cv.vocabulary_id) || []
}

/**
 * Gets existing vocabulary card IDs for a user.
 * Input: user id, vocabulary IDs to check
 * Output: Set of existing vocabulary IDs
 */
async function getExistingCardVocabularyIds(
  userId: string,
  vocabularyIds: string[]
): Promise<Set<string>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_deck_srs_cards')
    .select('vocabulary_id')
    .eq('user_id', userId)
    .eq('card_type', 'vocabulary')
    .in('vocabulary_id', vocabularyIds)

  if (error) {
    logger.error({
      userId,
      error: error.message,
      code: error.code
    }, 'Error checking existing vocabulary cards')
    throw error
  }

  return new Set(
    (data || [])
      .map(card => card.vocabulary_id)
      .filter((id): id is string => id !== null)
  )
}

/**
 * Builds card insert data for new vocabulary.
 * Input: user id, deck id, vocabulary IDs
 * Output: array of card insert data
 */
function buildVocabularyCardsToInsert(
  userId: string,
  deckId: string,
  vocabularyIds: string[]
): TablesInsert<'user_deck_srs_cards'>[] {
  const newCard = createNewCard()

  return vocabularyIds.map(vocabularyId => ({
    user_id: userId,
    deck_id: deckId,
    vocabulary_id: vocabularyId,
    grammar_id: null,
    card_type: 'vocabulary' as Database['public']['Enums']['card_type'],
    state: 'New' as Database['public']['Enums']['srs_state'],
    stability: newCard.stability,
    difficulty: newCard.difficulty,
    due: newCard.due.toISOString(),
    total_reviews: newCard.reps,
    streak_incorrect: newCard.lapses,
    last_reviewed_date: newCard.last_review?.toISOString() || null
  }))
}

// ============================================================================
// GRAMMAR HELPERS
// ============================================================================

/**
 * Gets grammar IDs for a chapter.
 * Input: chapter id
 * Output: array of grammar IDs
 */
async function getChapterGrammarIds(
  chapterId: string
): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('chapter_grammar')
    .select('grammar_id')
    .eq('chapter_id', chapterId)

  if (error) {
    logger.error({
      chapterId,
      error: error.message,
      code: error.code
    }, 'Error fetching chapter grammar for initialization')
    throw error
  }

  return data?.map(cg => cg.grammar_id) || []
}

/**
 * Gets existing grammar card IDs for a user.
 * Input: user id, grammar IDs to check
 * Output: Set of existing grammar IDs
 */
async function getExistingCardGrammarIds(
  userId: string,
  grammarIds: string[]
): Promise<Set<string>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_deck_srs_cards')
    .select('grammar_id')
    .eq('user_id', userId)
    .eq('card_type', 'grammar')
    .in('grammar_id', grammarIds)

  if (error) {
    logger.error({
      userId,
      error: error.message,
      code: error.code
    }, 'Error checking existing grammar cards')
    throw error
  }

  return new Set(
    (data || [])
      .map(card => card.grammar_id)
      .filter((id): id is string => id !== null)
  )
}

/**
 * Builds card insert data for new grammar.
 * Input: user id, deck id, grammar IDs
 * Output: array of card insert data
 */
function buildGrammarCardsToInsert(
  userId: string,
  deckId: string,
  grammarIds: string[]
): TablesInsert<'user_deck_srs_cards'>[] {
  const newCard = createNewCard()

  return grammarIds.map(grammarId => ({
    user_id: userId,
    deck_id: deckId,
    vocabulary_id: null,
    grammar_id: grammarId,
    card_type: 'grammar' as Database['public']['Enums']['card_type'],
    state: 'New' as Database['public']['Enums']['srs_state'],
    stability: newCard.stability,
    difficulty: newCard.difficulty,
    due: newCard.due.toISOString(),
    total_reviews: newCard.reps,
    streak_incorrect: newCard.lapses,
    last_reviewed_date: newCard.last_review?.toISOString() || null
  }))
}

// ============================================================================
// COMMON HELPERS
// ============================================================================

/**
 * Bulk inserts cards into database.
 * Input: cards to insert
 * Output: void
 */
async function bulkInsertCards(
  cardsToInsert: TablesInsert<'user_deck_srs_cards'>[]
): Promise<void> {
  if (cardsToInsert.length === 0) return

  const supabase = await createClient()
  logger.debug({ cardCount: cardsToInsert.length }, 'Bulk inserting new cards')

  const { error } = await supabase
    .from('user_deck_srs_cards')
    .insert(cardsToInsert)

  if (error) {
    logger.error({
      cardCount: cardsToInsert.length,
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    }, 'Error bulk inserting cards')
    throw error
  }
}

