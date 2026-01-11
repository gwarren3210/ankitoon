import { Card, ReviewLog } from 'ts-fsrs'
import { StudySessionCache } from '@/lib/study/sessionTypes'
import { StudyCard } from '@/lib/study/types'
import { FsrsState } from '@/lib/study/fsrs'
import { logger } from '@/lib/logger'

/**
 * Session response data for API.
 * Input: N/A (type definition)
 * Output: formatted session data for client
 */
export interface SessionStartResponse {
  sessionId: string
  deckId: string
  cards: StudyCard[]
  numNewCards: number
  numCards: number
  startTime: Date
}

/**
 * Session end statistics.
 * Input: N/A (type definition)
 * Output: session statistics
 */
export interface SessionEndStats {
  cardsStudied: number
  accuracy: number
  timeSpentSeconds: number
}

/**
 * Review log entry for batch persistence.
 * Input: N/A (type definition)
 * Output: log entry with card reference
 */
export interface CollectedReviewLog {
  vocabularyId: string
  log: ReviewLog
  srsCardId: string
}

/**
 * Collected session data for end session processing.
 * Input: N/A (type definition)
 * Output: all data needed for session persistence
 */
export interface CollectedSessionData {
  cardsToUpdate: Map<string, Card>
  logsToPersist: CollectedReviewLog[]
  totalLogs: number
  logsWithGoodRating: number
}

/**
 * Transforms session cache to array of StudyCards for API response.
 * Input: study session cache
 * Output: array of StudyCard objects
 */
export function transformSessionToStudyCards(
  session: StudySessionCache
): StudyCard[] {
  const cardsArray: StudyCard[] = []

  for (const [vocabularyId, srsCard] of session.cards.entries()) {
    const vocabulary = session.vocabulary.get(vocabularyId)
    if (!vocabulary) {
      logger.error({ vocabularyId }, 'Vocabulary not found for id')
      throw new Error(`Vocabulary not found for id: ${vocabularyId}`)
    }

    const srsCardId = session.srsCardIds.get(vocabularyId)
    if (!srsCardId) {
      logger.error({ vocabularyId }, 'SRS card ID not found for vocabulary')
      throw new Error(`SRS card ID not found for vocabulary: ${vocabularyId}`)
    }

    const chapterExample = session.chapterExamples.get(vocabularyId) ?? null
    const globalExample = vocabulary.example ?? null

    cardsArray.push({
      srsCard,
      vocabulary,
      chapterExample,
      globalExample,
      srsCardId
    })
  }

  return cardsArray
}

/**
 * Creates session start response from session cache.
 * Input: session cache, deck id, original cards count
 * Output: formatted session start response
 */
export function createSessionStartResponse(
  session: StudySessionCache,
  deckId: string,
  cardsCount: number
): SessionStartResponse {
  const cards = transformSessionToStudyCards(session)
  const numNewCards = cards.filter(
    card => card.srsCard.state === FsrsState.New
  ).length

  return {
    sessionId: deckId,
    deckId,
    cards,
    numNewCards,
    numCards: cardsCount,
    startTime: session.createdAt
  }
}

/**
 * Collects cards and logs from session for batch processing.
 * Input: study session cache
 * Output: collected session data for persistence
 */
export function collectSessionDataForPersistence(
  session: StudySessionCache
): CollectedSessionData {
  const cardsToUpdate = new Map<string, Card>()
  const logsToPersist: CollectedReviewLog[] = []
  let totalLogs = 0
  let logsWithGoodRating = 0

  for (const [vocabularyId, logs] of session.logs.entries()) {
    if (logs.length === 0) continue

    const finalCard = session.cards.get(vocabularyId)
    if (!finalCard) continue

    cardsToUpdate.set(vocabularyId, finalCard)

    const srsCardId = session.srsCardIds.get(vocabularyId)
    if (!srsCardId) {
      logger.error(
        { vocabularyId, deckId: session.deckId },
        'Missing srsCardId for vocabulary in session cache'
      )
      throw new Error(
        `Missing srsCardId for vocabulary in session cache: ${vocabularyId}`
      )
    }

    for (const log of logs) {
      logsToPersist.push({ vocabularyId, log, srsCardId })
      totalLogs++
      if (log.rating >= 3) {
        logsWithGoodRating++
      }
    }
  }

  return { cardsToUpdate, logsToPersist, totalLogs, logsWithGoodRating }
}

/**
 * Calculates session statistics from collected data.
 * Input: collected session data, session start time
 * Output: session end statistics
 */
export function calculateSessionStats(
  collectedData: CollectedSessionData,
  sessionStartTime: Date
): SessionEndStats {
  const { totalLogs, logsWithGoodRating } = collectedData
  const accuracy =
    totalLogs > 0 ? (logsWithGoodRating / totalLogs) * 100 : 0
  const timeSpentSeconds = Math.floor(
    (Date.now() - sessionStartTime.getTime()) / 1000
  )

  return {
    cardsStudied: totalLogs,
    accuracy,
    timeSpentSeconds
  }
}
