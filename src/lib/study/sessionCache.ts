import { FsrsCard, FsrsReviewLog } from '@/lib/study/fsrs'
import { StudyCard } from '@/lib/study/types'
import { getRedisClient } from '@/lib/redis/client'
import { logger } from '@/lib/logger'
import {
  StudySessionCache,
  SerializedSession,
  SESSION_TTL_SECONDS,
  SESSION_TTL_MS
} from '@/lib/study/sessionTypes'
import {
  serializeSession,
  deserializeSession
} from '@/lib/study/sessionSerialization'

/**
 * Cache methods for study sessions
 * - createSession: creates a new study session in cache
 * - getSession: gets a study session from cache
 * - addLog: adds a review log to the session
 * - updateCard: updates a card in the session
 * - deleteSession: deletes a study session from cache
 * - generateSessionId: generates a unique session id
 */

function getRedisKey(sessionId: string): string {
  return `session:${sessionId}`
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
      chapterExamples: new Map(cards.map(card => [card.vocabulary.id, card.chapterExample])),
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
export async function addLog(sessionId: string, vocabularyId: string, log: FsrsReviewLog): Promise<void> {
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
export async function updateCard(sessionId: string, vocabularyId: string, card: FsrsCard): Promise<void> {
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
