import { Card, ReviewLog } from 'ts-fsrs'
import { StudyCard } from './types'
import { Tables } from '@/types/database.types'
import { getRedisClient } from '@/lib/redis/client'
import { logger } from '@/lib/pipeline/logger'

/**
 * Cache methods for study sessions
 * - createSession: creates a new study session in cache
 * - getSession: gets a study session from cache
 * - addLog: adds a review log to the session
 * - updateCard: updates a card in the session
 * - deleteSession: deletes a study session from cache
 * - generateSessionId: generates a unique session id
 */

interface StudySessionCache {
  userId: string
  chapterId: string
  deckId: string
  vocabulary: Map<string, Tables<'vocabulary'>>
  cards: Map<string, Card>
  logs: Map<string, ReviewLog[]>
  srsCardIds: Map<string, string>
  createdAt: Date
  expiresAt: Date
}

/**
 * Serialized session data for Redis storage
 */
interface SerializedSession extends Omit<StudySessionCache, 'createdAt' | 'expiresAt' | 'vocabulary' | 'cards' | 'logs' | 'srsCardIds'> {
  vocabulary: Record<string, Tables<'vocabulary'>>
  cards: Record<string, SerializedCard>
  logs: Record<string, SerializedReviewLog[]>
  srsCardIds: Record<string, string>
  createdAt: string
  expiresAt: string
}

/**
 * Serialized Card for Redis storage
 */
interface SerializedCard extends Omit<Card, 'due' | 'last_review'> {
  due: string,
  last_review?: string
}

/**
 * Serialized ReviewLog for Redis storage
 */
interface SerializedReviewLog extends Omit<ReviewLog, 'due' | 'review'> {
  due: string
  review: string
}

const SESSION_TTL_SECONDS = 30 * 60 // 30 minutes
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000

function getRedisKey(sessionId: string): string {
  return `session:${sessionId}`
}

/**
 * Serializes a Card to JSON format for Redis storage.
 * Input: Card object
 * Output: SerializedCard object
 */
function serializeCard(card: Card): SerializedCard {
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
function deserializeCard(serialized: SerializedCard): Card {
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
function serializeReviewLog(log: ReviewLog): SerializedReviewLog {
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
function deserializeReviewLog(serialized: SerializedReviewLog): ReviewLog {
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
function serializeSession(session: StudySessionCache): SerializedSession {
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
function deserializeSession(serialized: SerializedSession): StudySessionCache {
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

/**
 * Creates a new study session in cache.
 * Input: user id, chapter id, deck id, cards
 * Output: void
 */
export async function createSession(
  userId: string,
  chapterId: string,
  deckId: string,
  cards: StudyCard[]
): Promise<void> {
  const startTime = Date.now()
  const operation = 'createSession'
  const redisKey = getRedisKey(deckId)

  logger.debug(
    { sessionId: deckId, userId, chapterId, cardCount: cards.length, operation },
    'Creating session in cache'
  )

  try {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)

    const session: StudySessionCache = {
      userId,
      chapterId,
      deckId,
      vocabulary: new Map(cards.map(card => [card.vocabulary.id, card.vocabulary])),
      cards: new Map(cards.map(card => [card.vocabulary.id, card.srsCard])),
      logs: new Map(cards.map(card => [card.vocabulary.id, []])),
      srsCardIds: new Map(cards.map(card => [card.vocabulary.id, card.srsCardId])),
      createdAt: now,
      expiresAt
    }

    const serialized = serializeSession(session)
    const redis = await getRedisClient()
    await redis.setEx(redisKey, SESSION_TTL_SECONDS, JSON.stringify(serialized))

    const duration = Date.now() - startTime
    logger.info(
      {
        sessionId: deckId,
        userId,
        chapterId,
        cardCount: cards.length,
        operation,
        durationMs: duration,
        ttlSeconds: SESSION_TTL_SECONDS
      },
      'Session created successfully in cache'
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    const duration = Date.now() - startTime
    logger.error(
      {
        sessionId: deckId,
        userId,
        chapterId,
        operation,
        error: errorMessage,
        stack: errorStack,
        durationMs: duration
      },
      'Failed to create session in cache'
    )
    throw error
  }
}

/**
 * Gets a study session from cache.
 * Input: session id
 * Output: session or null if not found/expired
 */
export async function getSession(sessionId: string): Promise<StudySessionCache | null> {
  const startTime = Date.now()
  const operation = 'getSession'
  const redisKey = getRedisKey(sessionId)

  logger.debug({ sessionId, operation }, 'Getting session from cache')

  try {
    const redis = await getRedisClient()
    const serializedData = await redis.get(redisKey)

    if (!serializedData) {
      const duration = Date.now() - startTime
      logger.debug({ sessionId, operation, durationMs: duration }, 'Session not found in cache (cache miss)')
      return null
    }

    let serialized: SerializedSession
    try {
      serialized = JSON.parse(serializedData) as SerializedSession
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError)
      const duration = Date.now() - startTime
      logger.error(
        { sessionId, operation, error: errorMessage, durationMs: duration },
        'Failed to deserialize session data'
      )
      await redis.del(redisKey)
      return null
    }

    const session = deserializeSession(serialized)

    // Check expiration
    if (session.expiresAt < new Date()) {
      const duration = Date.now() - startTime
      logger.debug(
        { sessionId, operation, expiresAt: session.expiresAt.toISOString(), durationMs: duration },
        'Session expired, deleting from cache'
      )
      await redis.del(redisKey)
      return null
    }

    const duration = Date.now() - startTime
    logger.debug(
      {
        sessionId,
        userId: session.userId,
        chapterId: session.chapterId,
        operation,
        durationMs: duration,
        cardCount: session.cards.size
      },
      'Session retrieved from cache (cache hit)'
    )

    return session
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    const duration = Date.now() - startTime
    logger.error(
      { sessionId, operation, error: errorMessage, stack: errorStack, durationMs: duration },
      'Failed to get session from cache'
    )
    throw error
  }
}

/**
 * Adds a review log to the session.
 * Input: session id, vocabulary id, review log
 * Output: void
 */
export async function addLog(sessionId: string, vocabularyId: string, log: ReviewLog): Promise<void> {
  const startTime = Date.now()
  const operation = 'addLog'
  const redisKey = getRedisKey(sessionId)

  logger.debug({ sessionId, vocabularyId, operation, rating: log.rating }, 'Adding log to session')

  try {
    const session = await getSession(sessionId)
    if (!session) {
      const error = new Error('Session not found or expired')
      logger.error({ sessionId, vocabularyId, operation }, 'Cannot add log: session not found')
      throw error
    }

    const logs = session.logs.get(vocabularyId) || []
    logs.push(log)
    session.logs.set(vocabularyId, logs)
    session.expiresAt = new Date(new Date().getTime() + SESSION_TTL_MS)

    const serialized = serializeSession(session)
    const redis = await getRedisClient()
    await redis.setEx(redisKey, SESSION_TTL_SECONDS, JSON.stringify(serialized))

    const duration = Date.now() - startTime
    logger.info(
      {
        sessionId,
        vocabularyId,
        operation,
        rating: log.rating,
        logCount: logs.length,
        durationMs: duration,
        ttlRefreshed: true
      },
      'Log added to session and TTL refreshed'
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    const duration = Date.now() - startTime
    logger.error(
      { sessionId, vocabularyId, operation, error: errorMessage, stack: errorStack, durationMs: duration },
      'Failed to add log to session'
    )
    throw error
  }
}

/**
 * Updates a card in the session.
 * Input: session id, vocabulary id, card
 * Output: void
 */
export async function updateCard(sessionId: string, vocabularyId: string, card: Card): Promise<void> {
  const startTime = Date.now()
  const operation = 'updateCard'
  const redisKey = getRedisKey(sessionId)

  logger.debug(
    { sessionId, vocabularyId, operation, cardState: card.state, due: card.due.toISOString() },
    'Updating card in session'
  )

  try {
    const session = await getSession(sessionId)
    if (!session) {
      const error = new Error('Session not found or expired')
      logger.error({ sessionId, vocabularyId, operation }, 'Cannot update card: session not found')
      throw error
    }

    session.cards.set(vocabularyId, card)
    session.expiresAt = new Date(new Date().getTime() + SESSION_TTL_MS)

    const serialized = serializeSession(session)
    const redis = await getRedisClient()
    await redis.setEx(redisKey, SESSION_TTL_SECONDS, JSON.stringify(serialized))

    const duration = Date.now() - startTime
    logger.info(
      {
        sessionId,
        vocabularyId,
        operation,
        cardState: card.state,
        durationMs: duration,
        ttlRefreshed: true
      },
      'Card updated in session and TTL refreshed'
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    const duration = Date.now() - startTime
    logger.error(
      { sessionId, vocabularyId, operation, error: errorMessage, stack: errorStack, durationMs: duration },
      'Failed to update card in session'
    )
    throw error
  }
}

/**
 * Deletes a session from cache.
 * Input: session id
 * Output: session or null
 */
export async function deleteSession(sessionId: string): Promise<StudySessionCache | null> {
  const startTime = Date.now()
  const operation = 'deleteSession'
  const redisKey = getRedisKey(sessionId)

  logger.debug({ sessionId, operation }, 'Deleting session from cache')

  try {
    const session = await getSession(sessionId)
    if (!session) {
      const duration = Date.now() - startTime
      logger.debug({ sessionId, operation, durationMs: duration }, 'Session not found for deletion')
      return null
    }

    const redis = await getRedisClient()
    await redis.del(redisKey)

    const duration = Date.now() - startTime
    logger.info(
      {
        sessionId,
        userId: session.userId,
        chapterId: session.chapterId,
        operation,
        durationMs: duration
      },
      'Session deleted from cache'
    )

    return session
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    const duration = Date.now() - startTime
    logger.error(
      { sessionId, operation, error: errorMessage, stack: errorStack, durationMs: duration },
      'Failed to delete session from cache'
    )
    throw error
  }
}

/**
 * Generates a unique session ID.
 * Input: none
 * Output: unique session id string
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

