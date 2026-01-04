import { Database, TablesInsert } from '@/types/database.types'
import { logger } from '@/lib/logger'
import { createNewCard } from '@/lib/study/fsrs'
import { DbClient } from '@/lib/study/types'

/**
 * Initializes all vocabulary cards for a chapter (first time study).
 * Bulk inserts all cards with state 'New' for efficient initialization.
 * Input: supabase client, user id, deck id, chapter id
 * Output: number of cards initialized
 */
export async function initializeChapterCards(
  supabase: DbClient,
  userId: string,
  deckId: string,
  chapterId: string
): Promise<number> {
  logger.debug({ userId, deckId, chapterId }, 'Initializing chapter cards')
  
  const vocabularyIds = await getChapterVocabularyIds(supabase, chapterId)
  
  if (vocabularyIds.length === 0) {
    logger.warn({ userId, deckId, chapterId }, 'No vocabulary found for chapter')
    return 0
  }

  const existingVocabularyIds = await getExistingCardVocabularyIds(supabase, userId, deckId, vocabularyIds)
  const newVocabularyIds = vocabularyIds.filter(id => !existingVocabularyIds.has(id))

  if (newVocabularyIds.length === 0) {
    logger.debug({ userId, deckId, chapterId, totalVocabulary: vocabularyIds.length, existingCount: existingVocabularyIds.size }, 'All cards already initialized')
    return 0
  }

  const cardsToInsert = buildCardsToInsert(userId, deckId, newVocabularyIds)
  await bulkInsertCards(supabase, userId, deckId, chapterId, cardsToInsert)

  logger.info({ userId, deckId, chapterId, cardCount: newVocabularyIds.length }, 'Chapter cards initialized successfully')
  return newVocabularyIds.length
}

/**
 * Gets vocabulary IDs for a chapter
 * Input: supabase client, chapter id
 * Output: array of vocabulary IDs
 */
async function getChapterVocabularyIds(
  supabase: DbClient,
  chapterId: string
): Promise<string[]> {
  const { data: chapterVocab, error: vocabError } = await supabase
    .from('chapter_vocabulary')
    .select('vocabulary_id')
    .eq('chapter_id', chapterId)

  if (vocabError) {
    logger.error({ chapterId, error: vocabError.message, code: vocabError.code }, 'Error fetching chapter vocabulary for initialization')
    throw vocabError
  }

  return chapterVocab?.map(cv => cv.vocabulary_id) || []
}

/**
 * Gets existing card vocabulary IDs
 * Input: supabase client, user id, deck id, vocabulary IDs to check
 * Output: Set of existing vocabulary IDs
 */
async function getExistingCardVocabularyIds(
  supabase: DbClient,
  userId: string,
  deckId: string,
  vocabularyIds: string[]
): Promise<Set<string>> {
  const { data: existingCards, error: existingError } = await supabase
    .from('user_deck_srs_cards')
    .select('vocabulary_id')
    .eq('user_id', userId)
    .eq('deck_id', deckId)
    .in('vocabulary_id', vocabularyIds)

  if (existingError) {
    logger.error({ userId, deckId, error: existingError.message, code: existingError.code }, 'Error checking existing cards')
    throw existingError
  }

  return new Set((existingCards || []).map(card => card.vocabulary_id))
}

/**
 * Builds card insert data for new vocabulary
 * Input: user id, deck id, vocabulary IDs
 * Output: array of card insert data
 */
function buildCardsToInsert(
  userId: string,
  deckId: string,
  vocabularyIds: string[]
): TablesInsert<'user_deck_srs_cards'>[] {
  const newCard = createNewCard()
  
  return vocabularyIds.map(vocabularyId => ({
    user_id: userId,
    deck_id: deckId,
    vocabulary_id: vocabularyId,
    state: 'New' as Database['public']['Enums']['srs_state'],
    stability: newCard.stability,
    difficulty: newCard.difficulty,
    due: newCard.due.toISOString(),
    total_reviews: newCard.reps,
    streak_incorrect: newCard.lapses,
    last_reviewed_date: newCard.last_review?.toISOString() || null
  }))
}

/**
 * Bulk inserts cards into database
 * Input: supabase client, user id, deck id, chapter id, cards to insert
 * Output: void
 */
async function bulkInsertCards(
  supabase: DbClient,
  userId: string,
  deckId: string,
  chapterId: string,
  cardsToInsert: TablesInsert<'user_deck_srs_cards'>[]
): Promise<void> {
  logger.debug({ userId, deckId, chapterId, cardCount: cardsToInsert.length }, 'Bulk inserting new cards')
  const { error: insertError } = await supabase
    .from('user_deck_srs_cards')
    .insert(cardsToInsert)

  if (insertError) {
    logger.error({ userId, deckId, chapterId, cardCount: cardsToInsert.length, error: insertError.message, code: insertError.code }, 'Error bulk inserting cards')
    throw insertError
  }
}

