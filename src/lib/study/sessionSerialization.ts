import { Card, ReviewLog } from 'ts-fsrs'
import { Tables } from '@/types/database.types'
import {
  StudySessionCache,
  SerializedSession,
  SerializedCard,
  SerializedReviewLog
} from '@/lib/study/sessionTypes'

/**
 * Serializes a Card to JSON format for Redis storage.
 * Input: Card object
 * Output: SerializedCard object
 */
export function serializeCard(card: Card): SerializedCard {
  return {
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review?.toISOString()
  }
}

/**
 * Deserializes a SerializedCard back to Card object.
 * Input: SerializedCard object
 * Output: Card object
 */
export function deserializeCard(serialized: SerializedCard): Card {
  return {
    ...serialized,
    due: new Date(serialized.due),
    last_review: serialized.last_review ? new Date(serialized.last_review) : undefined
  }
}

/**
 * Serializes a ReviewLog to JSON format for Redis storage.
 * Input: ReviewLog object
 * Output: SerializedReviewLog object
 */
export function serializeReviewLog(log: ReviewLog): SerializedReviewLog {
  return {
    ...log,
    due: log.due.toISOString(),
    review: log.review.toISOString(),
  }
}

/**
 * Deserializes a SerializedReviewLog back to ReviewLog object.
 * Input: SerializedReviewLog object
 * Output: ReviewLog object
 */
export function deserializeReviewLog(serialized: SerializedReviewLog): ReviewLog {
  return {
    ...serialized,
    due: new Date(serialized.due),
    review: new Date(serialized.review),
  }
}

/**
 * Serializes a StudySessionCache to JSON format for Redis storage.
 * Input: StudySessionCache object
 * Output: SerializedSession object
 */
export function serializeSession(session: StudySessionCache): SerializedSession {
  const vocabularyObj: Record<string, Tables<'vocabulary'>> = {}
  for (const [key, value] of session.vocabulary.entries()) {
    vocabularyObj[key] = value
  }

  const cardsObj: Record<string, SerializedCard> = {}
  for (const [key, value] of session.cards.entries()) {
    cardsObj[key] = serializeCard(value)
  }

  const logsObj: Record<string, SerializedReviewLog[]> = {}
  for (const [key, value] of session.logs.entries()) {
    logsObj[key] = value.map(serializeReviewLog)
  }

  const srsCardIdsObj: Record<string, string> = {}
  for (const [key, value] of session.srsCardIds.entries()) {
    srsCardIdsObj[key] = value
  }

  return {
    userId: session.userId,
    chapterId: session.chapterId,
    deckId: session.deckId,
    vocabulary: vocabularyObj,
    cards: cardsObj,
    logs: logsObj,
    srsCardIds: srsCardIdsObj,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString()
  }
}

/**
 * Deserializes a SerializedSession back to StudySessionCache object.
 * Input: SerializedSession object
 * Output: StudySessionCache object
 */
export function deserializeSession(serialized: SerializedSession): StudySessionCache {
  const vocabulary = new Map<string, Tables<'vocabulary'>>()
  for (const [key, value] of Object.entries(serialized.vocabulary)) {
    vocabulary.set(key, value)
  }

  const cards = new Map<string, Card>()
  for (const [key, value] of Object.entries(serialized.cards)) {
    cards.set(key, deserializeCard(value))
  }

  const logs = new Map<string, ReviewLog[]>()
  for (const [key, value] of Object.entries(serialized.logs)) {
    logs.set(key, value.map(deserializeReviewLog))
  }

  const srsCardIds = new Map<string, string>()
  for (const [key, value] of Object.entries(serialized.srsCardIds || {})) {
    srsCardIds.set(key, value)
  }

  return {
    userId: serialized.userId,
    chapterId: serialized.chapterId,
    deckId: serialized.deckId,
    vocabulary,
    cards,
    logs,
    srsCardIds,
    createdAt: new Date(serialized.createdAt),
    expiresAt: new Date(serialized.expiresAt)
  }
}

