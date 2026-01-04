import { TablesInsert, Database } from '@/types/database.types'
import { logger } from '@/lib/logger'
import { DbClient } from './types'
import { fsrsStateToDbState } from './utils'
import { FsrsRating, FsrsReviewLog, FsrsCard } from './fsrs'

/**
 * Maps FSRS Rating enum to database rating_type enum
 * Input: FSRS Rating enum value
 * Output: database rating_type string
 */
function ratingToDbRating(
    rating: FsrsRating
): Database['public']['Enums']['rating_type'] {
  switch (rating) {
    case FsrsRating.Again:
      return 'Again'
    case FsrsRating.Hard:
      return 'Hard'
    case FsrsRating.Good:
      return 'Good'
    case FsrsRating.Easy:
      return 'Easy'
    case FsrsRating.Manual:
      return 'Manual'
  }
}

/**
 * Builds card insert data from FSRS card
 * Input: deck id, vocabulary id, user id, FSRS card
 * Output: card insert data
 */
function buildCardInsertData(
  deckId: string,
  vocabularyId: string,
  userId: string,
  srsCard: FsrsCard
): TablesInsert<'user_deck_srs_cards'> {
  return {
    deck_id: deckId,
    vocabulary_id: vocabularyId,
    user_id: userId,
    state: fsrsStateToDbState(srsCard.state),
    stability: srsCard.stability,
    difficulty: srsCard.difficulty,
    total_reviews: srsCard.reps,
    streak_incorrect: srsCard.lapses,
    due: srsCard.due.toISOString(),
    last_reviewed_date: srsCard.last_review?.toISOString() || null
  }
}

/**
 * Builds log data from ReviewLog
 * Input: user id, vocabulary id, ReviewLog, srs card id
 * Output: log insert data
 */
function buildLogDataFromReviewLog(
  userId: string,
  vocabularyId: string,
  log: FsrsReviewLog,
  srsCardId: string,
): TablesInsert<'srs_progress_logs'> {
  return {
    user_id: userId,
    vocabulary_id: vocabularyId,
    srs_card_id: srsCardId,
    due: log.due.toISOString(),
    stability: log.stability,
    difficulty: log.difficulty,
    elapsed_days: log.elapsed_days,
    scheduled_days: log.scheduled_days,
    learning_steps: log.learning_steps,
    state: fsrsStateToDbState(log.state),
    last_review: log.review.toISOString(),
    rating: ratingToDbRating(log.rating),
    review: log.review.toISOString()
  }
}

/**
 * Batch updates multiple SRS cards
 * Input: supabase client, user id, deck id, map of vocabulary id to card
 * Output: void
 */
export async function batchUpdateSrsCards(
  supabase: DbClient,
  userId: string,
  deckId: string,
  cards: Map<string, FsrsCard>
): Promise<void> {
  if (cards.size === 0) {
    logger.debug({ userId, deckId }, 'No cards to update')
    return
  }

  const insertData = Array.from(cards.entries()).map(([vocabularyId, srsCard]) =>
    buildCardInsertData(deckId, vocabularyId, userId, srsCard)
  )

  logger.debug({ userId, deckId, cardCount: cards.size }, 'Batch updating SRS cards')
  const { error } = await supabase
    .from('user_deck_srs_cards')
    .upsert(insertData, {
      onConflict: 'deck_id,vocabulary_id,user_id'
    })

  if (error) {
    logger.error({ userId, deckId, cardCount: cards.size, error: error.message, code: error.code }, 'Error batch updating SRS cards')
    throw error
  }
  logger.debug({ userId, deckId, cardCount: cards.size }, 'SRS cards batch updated successfully')
}

/**
 * Interface for review log entry with vocabulary and card IDs
 */
export interface ReviewLogEntry {
  vocabularyId: string
  log: FsrsReviewLog
  srsCardId: string
}

/**
 * Batch logs multiple reviews
 * Input: supabase client, user id, array of review log entries
 * Output: void
 */
export async function batchLogReviews(
  supabase: DbClient,
  userId: string,
  logs: ReviewLogEntry[]
): Promise<void> {
  if (logs.length === 0) {
    logger.debug({ userId }, 'No reviews to log')
    return
  }

  const insertData = logs.map(({ vocabularyId, log, srsCardId }) =>
    buildLogDataFromReviewLog(userId, vocabularyId, log, srsCardId)
  )

  logger.debug({ userId, logCount: logs.length }, 'Batch logging reviews')
  const { error } = await supabase
    .from('srs_progress_logs')
    .insert(insertData)

  if (error) {
    logger.error({ userId, logCount: logs.length, error: error.message, code: error.code }, 'Error batch logging reviews')
    throw error
  }
  logger.debug({ userId, logCount: logs.length }, 'Reviews batch logged successfully')
}

/**
 * Persists session reviews using RPC function for transaction support.
 * Falls back to batch operations if RPC fails.
 * Input: supabase client, user id, deck id, cards map, review logs array
 * Output: void
 */
export async function persistSessionReviews(
  supabase: DbClient,
  userId: string,
  deckId: string,
  cards: Map<string, FsrsCard>,
  logs: ReviewLogEntry[]
): Promise<void> {
  if (cards.size === 0 && logs.length === 0) {
    logger.debug({ userId, deckId }, 'No cards or logs to persist')
    return
  }

  const cardUpdates = Array.from(cards.entries()).map(([vocabularyId, card]) => ({
    vocabulary_id: vocabularyId,
    state: fsrsStateToDbState(card.state),
    stability: card.stability,
    difficulty: card.difficulty,
    total_reviews: card.reps,
    streak_incorrect: card.lapses,
    due: card.due.toISOString(),
    last_reviewed_date: card.last_review?.toISOString() || null
  }))

  const reviewLogs = logs.map(({ vocabularyId, log, srsCardId }) => {
    const logData = buildLogDataFromReviewLog(userId, vocabularyId, log, srsCardId)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { user_id, ...logDataWithoutUserId } = logData
    return logDataWithoutUserId
  })

  logger.debug({ userId, deckId, cardCount: cardUpdates.length, logCount: reviewLogs.length }, 'Persisting session reviews via RPC')
  
  const { error: rpcError } = await supabase.rpc('persist_session_reviews', {
    p_user_id: userId,
    p_deck_id: deckId,
    p_card_updates: cardUpdates,
    p_review_logs: reviewLogs
  })

  if (rpcError) {
    logger.warn({ userId, deckId, error: rpcError.message, code: rpcError.code }, 'RPC persist failed, falling back to batch operations')
    await batchUpdateSrsCards(supabase, userId, deckId, cards)
    await batchLogReviews(supabase, userId, logs)
    return
  }

  logger.debug({ userId, deckId }, 'Session reviews persisted successfully via RPC')
}
