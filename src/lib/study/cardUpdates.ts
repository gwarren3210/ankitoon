import { TablesInsert } from '@/types/database.types'
import { Card } from 'ts-fsrs'
import { logger } from '@/lib/logger'
import { DbClient } from './types'
import { fsrsStateToDbState } from './utils'

/**
 * Creates or updates an SRS card after a review.
 * Input: supabase client, user id, deck id, vocabulary id, updated card
 * Output: void
 */
export async function updateSrsCard(
  supabase: DbClient,
  userId: string,
  deckId: string,
  vocabularyId: string,
  card: Card
): Promise<void> {
  const insertData = buildCardInsertData(deckId, vocabularyId, userId, card)

  logger.debug({ userId, deckId, vocabularyId, state: card.state, stability: card.stability, difficulty: card.difficulty }, 'Updating SRS card')
  const { error } = await supabase
    .from('user_deck_srs_cards')
    .upsert(insertData, {
      onConflict: 'deck_id,vocabulary_id,user_id'
    })

  if (error) {
    logger.error({ userId, deckId, vocabularyId, error: error.message, code: error.code }, 'Error updating SRS card')
    throw error
  }
  logger.debug({ userId, deckId, vocabularyId }, 'SRS card updated successfully')
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
  card: Card
): TablesInsert<'user_deck_srs_cards'> {
  return {
    deck_id: deckId,
    vocabulary_id: vocabularyId,
    user_id: userId,
    state: fsrsStateToDbState(card.state),
    stability: card.stability,
    difficulty: card.difficulty,
    total_reviews: card.reps,
    streak_incorrect: card.lapses,
    due: card.due.toISOString(),
    last_reviewed_date: card.last_review?.toISOString() || null
  }
}

/**
 * Logs a review to the SRS progress logs table.
 * Input: supabase client, user id, vocabulary id, card after review, srs card id
 * Output: void
 */
export async function logReview(
  supabase: DbClient,
  userId: string,
  vocabularyId: string,
  card: Card,
  srsCardId?: string
): Promise<void> {
  const logData = buildLogData(userId, vocabularyId, card, srsCardId)

  logger.debug({ userId, vocabularyId, srsCardId, state: card.state, reps: card.reps }, 'Logging review')
  const { error } = await supabase
    .from('srs_progress_logs')
    .insert(logData)

  if (error) {
    logger.error({ userId, vocabularyId, srsCardId, error: error.message, code: error.code }, 'Error logging review')
    throw error
  }
  logger.debug({ userId, vocabularyId }, 'Review logged successfully')
}

/**
 * Builds log data from FSRS card
 * Input: user id, vocabulary id, FSRS card, srs card id
 * Output: log insert data
 */
function buildLogData(
  userId: string,
  vocabularyId: string,
  card: Card,
  srsCardId?: string
): TablesInsert<'srs_progress_logs'> {
  return {
    user_id: userId,
    vocabulary_id: vocabularyId,
    srs_card_id: srsCardId || null,
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: fsrsStateToDbState(card.state),
    last_review: card.last_review?.toISOString() || null
  }
}

