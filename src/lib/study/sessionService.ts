/**
 * Study Session Service - Orchestration Layer
 * ============================================
 *
 * This module coordinates the study session lifecycle using a dual-storage
 * pattern optimized for performance:
 *
 * STORAGE ARCHITECTURE:
 * ---------------------
 * Redis (sessionCache.ts) - Working memory during active study
 *   - Stores cards, review logs, vocabulary data
 *   - 30-minute TTL (refreshed on activity)
 *   - SOURCE OF TRUTH during active session
 *   - Enables instant UI feedback (no DB latency)
 *
 * PostgreSQL (via batchCardUpdates.ts, sessions.ts) - Durable persistence
 *   - SRS card state persisted at session END via persist_session_reviews RPC
 *   - Session analytics stored in user_chapter_study_sessions table
 *   - SOURCE OF TRUTH between sessions
 *
 * DATA FLOW:
 * ----------
 * START:  DB(get cards) -> Redis(create cache)
 * RATE:   Redis only (optimistic, no DB writes during study)
 * END:    Redis -> DB(persist reviews + analytics) -> Redis(delete cache)
 *
 * WHY THIS PATTERN:
 * -----------------
 * Database writes take ~200ms which interrupts study flow. By caching in
 * Redis during study and batch-persisting at the end, users experience
 * instant feedback while maintaining data durability.
 *
 * KEY FILES:
 * ----------
 * - sessionService.ts      - This file; orchestrates start/end session
 * - sessionCache.ts        - Redis CRUD operations (active session state)
 * - sessionTypes.ts        - Type definitions and TTL constants
 * - sessionSerialization.ts - Map<->Record conversion for JSON storage
 * - sessions.ts            - DB session analytics (created at END only)
 * - batchCardUpdates.ts    - Persists SRS card state to DB at END
 */

import { StudyCard } from '@/lib/study/types'
import { getStudyCards } from '@/lib/study/cardRetrieval'
import {
  createSession,
  getSession,
  deleteSession
} from '@/lib/study/sessionCache'
import { initializeChapterCards } from '@/lib/study/initialization'
import { getOrCreateDeck } from '@/lib/study/deckManagement'
import { createStudySession } from '@/lib/study/sessions'
import { updateChapterProgress, updateSeriesProgress } from '@/lib/study/progress'
import {
  persistSessionReviews,
  ReviewLogEntry
} from '@/lib/study/batchCardUpdates'
import {
  validateChapterAndGetCounts,
  ChapterValidationError,
  getChapterSeriesId
} from '@/lib/study/chapterQueries'
import {
  createSessionStartResponse,
  collectSessionDataForPersistence,
  calculateSessionStats,
  SessionStartResponse,
  SessionEndStats
} from '@/lib/study/sessionDataTransform'
import { StudySessionCache } from '@/lib/study/sessionTypes'
import { getChapterProgress } from '@/lib/progress/queries/chapterProgressQueries'
import { logger } from '@/lib/logger'

/**
 * Error types for session start
 */
export type StartSessionError =
  | { type: 'chapter_not_found' }
  | { type: 'no_vocabulary' }
  | { type: 'deck_creation_failed'; message: string }
  | { type: 'validation_failed'; message: string }
  | { type: 'initialization_failed'; message: string }
  | { type: 'card_retrieval_failed'; message: string }
  | { type: 'session_creation_failed'; message: string }

/**
 * Error types for session end
 */
export type EndSessionError =
  | { type: 'session_not_found' }
  | { type: 'unauthorized' }
  | { type: 'persistence_failed'; message: string }

/**
 * Starts a study session for a chapter.
 * Orchestrates deck creation, card initialization, and session cache setup.
 * Input: user id, chapter id
 * Output: session start response or error
 */
export async function startStudySession(
  userId: string,
  chapterId: string
): Promise<
  | { success: true; data: SessionStartResponse }
  | { success: false; error: StartSessionError }
> {
  logger.info({ userId, chapterId }, 'Starting study session')

  // Get or create deck
  let deck
  try {
    deck = await getOrCreateDeck(userId, chapterId)
  } catch (error) {
    logger.error({ userId, chapterId, error }, 'Error getting or creating deck')
    return {
      success: false,
      error: {
        type: 'deck_creation_failed',
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // Validate chapter and get card counts in parallel
  const validationResult = await validateChapterAndGetCounts(
    userId,
    chapterId,
    deck.id
  )

  if (!validationResult.success) {
    return { success: false, error: mapValidationError(validationResult.error) }
  }

  const { existingCardsCount, totalCardsCount } = validationResult.data

  // Initialize cards if needed
  const initResult = await initializeCardsIfNeeded(
    userId,
    deck.id,
    chapterId,
    existingCardsCount,
    totalCardsCount
  )

  if (!initResult.success) {
    return { success: false, error: initResult.error }
  }

  // Get chapter progress to determine which examples to show
  const progress = await getChapterProgress(userId, chapterId)
  const isChapterCompleted = progress?.completed ?? false

  // Get study cards
  let cards: StudyCard[]
  try {
    cards = await getStudyCards(userId, chapterId, isChapterCompleted)
  } catch (error) {
    logger.error({ userId, chapterId, error }, 'Error fetching study cards')
    return {
      success: false,
      error: {
        type: 'card_retrieval_failed',
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // Create or get session from cache
  const sessionResult = await getOrCreateSessionCache(
    userId,
    chapterId,
    deck.id,
    cards,
    isChapterCompleted
  )

  if (!sessionResult.success) {
    return { success: false, error: sessionResult.error }
  }

  const response = createSessionStartResponse(
    sessionResult.data,
    deck.id,
    cards.length
  )

  logger.info(
    {
      userId,
      chapterId,
      deckId: deck.id,
      sessionId: deck.id,
      cardCount: response.numCards,
      numNewCards: response.numNewCards
    },
    'Session started successfully'
  )

  return { success: true, data: response }
}

/**
 * Ends a study session and persists all data.
 * Input: user id, session id
 * Output: session end stats or error
 */
export async function endStudySession(
  userId: string,
  sessionId: string
): Promise<
  | { success: true; data: SessionEndStats }
  | { success: false; error: EndSessionError }
> {
  logger.info({ userId, sessionId }, 'Ending study session')

  // Get session from cache
  const session = await getSession(sessionId)
  if (!session) {
    logger.warn({ userId, sessionId }, 'Session not found or expired')
    return { success: false, error: { type: 'session_not_found' } }
  }

  // Verify ownership
  if (session.userId !== userId) {
    logger.warn(
      { userId, sessionUserId: session.userId, sessionId },
      'Unauthorized access attempt'
    )
    return { success: false, error: { type: 'unauthorized' } }
  }

  // Collect session data for persistence
  const collectedData = collectSessionDataForPersistence(session)
  const stats = calculateSessionStats(collectedData, session.createdAt)

  logger.info(
    {
      userId,
      sessionId,
      deckId: session.deckId,
      cardsToUpdate: collectedData.cardsToUpdate.size,
      logsToPersist: collectedData.logsToPersist.length
    },
    'Persisting session reviews'
  )

  // Persist reviews
  try {
    await persistSessionReviews(
      userId,
      session.deckId,
      collectedData.cardsToUpdate,
      collectedData.logsToPersist as ReviewLogEntry[]
    )
  } catch (error) {
    logger.error(
      { userId, sessionId, deckId: session.deckId, error },
      'Error persisting session reviews'
    )
    return {
      success: false,
      error: {
        type: 'persistence_failed',
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // Update progress (non-blocking)
  await updateProgressAfterSession(userId, session, stats)

  // Delete session from cache
  await cleanupSession(sessionId, userId)

  logger.info(
    {
      userId,
      sessionId,
      chapterId: session.chapterId,
      ...stats
    },
    'Session ended successfully'
  )

  return { success: true, data: stats }
}

/**
 * Maps chapter validation error to start session error.
 * Input: chapter validation error
 * Output: start session error
 */
function mapValidationError(error: ChapterValidationError): StartSessionError {
  switch (error.type) {
    case 'chapter_not_found':
      return { type: 'chapter_not_found' }
    case 'no_vocabulary':
      return { type: 'no_vocabulary' }
    case 'query_error':
      return { type: 'validation_failed', message: error.message }
  }
}

/**
 * Initializes chapter cards if needed.
 * Input: user id, deck id, chapter id, existing count, total
 * Output: success or error
 */
async function initializeCardsIfNeeded(
  userId: string,
  deckId: string,
  chapterId: string,
  existingCardsCount: number,
  totalCardsCount: number
): Promise<{ success: true } | { success: false; error: StartSessionError }> {
  if (existingCardsCount >= totalCardsCount) {
    logger.debug(
      { userId, deckId, chapterId, existingCardsCount, totalCardsCount },
      'All cards already initialized'
    )
    return { success: true }
  }

  const cardsToInitialize = totalCardsCount - existingCardsCount
  logger.info(
    { userId, deckId, chapterId, cardsToInitialize },
    'Initializing cards for chapter'
  )

  try {
    const initializedCount = await initializeChapterCards(
      userId,
      deckId,
      chapterId
    )
    logger.info(
      { userId, deckId, chapterId, initializedCount },
      'Cards initialized successfully'
    )
    return { success: true }
  } catch (error) {
    logger.error(
      { userId, deckId, chapterId, error },
      'Error initializing chapter cards'
    )
    return {
      success: false,
      error: {
        type: 'initialization_failed',
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

/**
 * Gets existing session or creates new one in cache.
 * Input: user id, chapter id, deck id, cards, whether chapter is completed
 * Output: session cache or error
 */
async function getOrCreateSessionCache(
  userId: string,
  chapterId: string,
  deckId: string,
  cards: StudyCard[],
  isChapterCompleted: boolean
): Promise<
  | { success: true; data: StudySessionCache }
  | { success: false; error: StartSessionError }
> {
  let session = await getSession(deckId)

  if (session && session.expiresAt >= new Date()) {
    logger.info(
      { userId, chapterId, deckId, sessionId: deckId },
      'Reusing existing valid session'
    )
    return { success: true, data: session }
  }

  if (session) {
    logger.debug(
      { userId, chapterId, deckId },
      'Existing session expired, creating new'
    )
  } else {
    logger.debug({ userId, chapterId, deckId }, 'Creating new session')
  }

  await createSession(userId, chapterId, deckId, cards, isChapterCompleted)
  session = await getSession(deckId)

  if (!session) {
    logger.error(
      { userId, chapterId, deckId },
      'Failed to create session - null after creation'
    )
    return {
      success: false,
      error: { type: 'session_creation_failed', message: 'Session is null' }
    }
  }

  return { success: true, data: session }
}

/**
 * Updates chapter and series progress after session ends.
 * Non-critical - failures are logged but don't fail the operation.
 * Input: user id, session cache, session stats
 * Output: void
 */
async function updateProgressAfterSession(
  userId: string,
  session: StudySessionCache,
  stats: SessionEndStats
): Promise<void> {
  const seriesId = await getChapterSeriesId(session.chapterId)

  if (!seriesId) {
    logger.warn(
      { userId, chapterId: session.chapterId },
      'Chapter not found, skipping progress updates'
    )
    return
  }

  // Create study session record and update chapter progress in parallel
  try {
    await Promise.all([
      createStudySession(userId, session.chapterId, {
        deckId: session.deckId,
        cardsStudied: stats.cardsStudied,
        accuracy: stats.accuracy / 100,
        timeSpentSeconds: stats.timeSpentSeconds,
        startTime: session.createdAt,
        endTime: new Date()
      }),
      updateChapterProgress(
        userId,
        session.chapterId,
        seriesId,
        session.deckId,
        stats.accuracy / 100,
        stats.timeSpentSeconds,
        session.cards
      )
    ])
  } catch (error) {
    logger.error(
      { userId, chapterId: session.chapterId, error },
      'Error in session/progress operations'
    )
    // Continue - don't fail the whole operation
  }

  // Update series progress after chapter progress
  try {
    await updateSeriesProgress(userId, seriesId)
  } catch (error) {
    logger.error(
      { userId, seriesId, error },
      'Error updating series progress'
    )
    // Continue - don't fail the whole operation
  }
}

/**
 * Cleans up session from cache.
 * Input: session id, user id
 * Output: void
 */
async function cleanupSession(
  sessionId: string,
  userId: string
): Promise<void> {
  try {
    await deleteSession(sessionId)
    logger.debug({ userId, sessionId }, 'Session deleted from cache')
  } catch (error) {
    logger.error(
      { sessionId, userId, error },
      'Failed to delete session from cache'
    )
    // Continue - deletion failure shouldn't fail the operation
  }
}
