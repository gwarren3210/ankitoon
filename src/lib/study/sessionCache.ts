import { Card, ReviewLog } from 'ts-fsrs'
import { StudyCard } from './studyData'
import { Tables } from '@/types/database.types'

/**
 * Cache methods for study sessions
 * - createSession: creates a new study session in cache
 * - getSession: gets a study session from cache
 * - addLog: adds a review log to the session
 * - getUpdatedCard: gets the updated card from the session
 * - deleteSession: deletes a study session from cache
 * - generateSessionId: generates a unique session id
 */

/**
 * Study session cache interface
 * @interface StudySessionCache
 * @property {string} userId - The user id
 * @property {string} chapterId - The chapter id
 * @property {string} deckId - The deck id
 * @property {Map<string, Tables<'vocabulary'>>} vocabulary - The vocabulary map
 * @property {Map<string, Card>} cards - The cards map
 * @property {Map<string, ReviewLog[]>} logs - The logs map
 * @property {Date} createdAt - The creation date
 * @property {Date} expiresAt - The expiration date
 */
interface StudySessionCache {
  userId: string
  chapterId: string
  deckId: string
  vocabulary: Map<string, Tables<'vocabulary'>>
  cards: Map<string, Card>
  logs: Map<string, ReviewLog[]>
  createdAt: Date
  expiresAt: Date
}

const SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutes
const sessions = new Map<string, StudySessionCache>()

// Cleanup expired sessions every 5 minutes
setInterval(() => {
  const now = new Date()
  for (const [sessionId, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(sessionId)
    }
  }
}, 5 * 60 * 1000)

/**
 * Creates a new study session in cache.
 * Input: deck id, user id, chapter id, cards
 * Output: void
 */
export function createSession(
  userId: string,
  chapterId: string,
  deckId: string,
  cards: StudyCard[]
): void {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)

  sessions.set(deckId, {
    userId,
    chapterId,
    deckId,
    vocabulary: new Map(cards.map(card => [card.vocabulary.id, card.vocabulary])),
    cards: new Map(cards.map(card => [card.vocabulary.id, card.srsCard])),
    logs: new Map(cards.map(card => [card.vocabulary.id, []])),
    createdAt: now,
    expiresAt
  })
}

/**
 * Gets a study session from cache.
 * Input: session id
 * Output: session or null if not found/expired
 */
export function getSession(sessionId: string): StudySessionCache | null {
  const session = sessions.get(sessionId)
  if (!session) {
    return null
  }

  if (session.expiresAt < new Date()) {
    sessions.delete(sessionId)
    return null
  }

  return session
}

/**
 * Adds a review log to the session.
 * Input: session id, review log
 * Output: void
 */
export function addLog(sessionId: string, vocabularyId: string, log: ReviewLog): void {
  const session = getSession(sessionId)
  if (!session) {
    throw new Error('Session not found or expired')
  }

  session.logs.get(vocabularyId)?.push(log)
  session.expiresAt = new Date(new Date().getTime() + SESSION_TTL_MS)
}

/**
 * Updates a card in the session.
 * Input: session id, vocabulary id, card
 * Output: void
 */
export function updateCard(sessionId: string, vocabularyId: string, card: Card): void {
  const session = getSession(sessionId)
  if (!session) {
    throw new Error('Session not found or expired')
  }
  session.cards.set(vocabularyId, card)
  session.expiresAt = new Date(new Date().getTime() + SESSION_TTL_MS)
}

/**
 * Deletes a session from cache.
 * Input: session id
 * Output: session or null
 */
export function deleteSession(sessionId: string): StudySessionCache | null {
  const session = sessions.get(sessionId)
  if (session) {
    sessions.delete(sessionId)
  }
  return session || null
}

/**
 * Generates a unique session ID.
 * Input: none
 * Output: unique session id string
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

