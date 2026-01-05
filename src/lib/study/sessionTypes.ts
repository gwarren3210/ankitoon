import { Card, ReviewLog } from 'ts-fsrs'
import { Tables } from '@/types/database.types'

/**
 * Study session cache interface
 */
export interface StudySessionCache {
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
export interface SerializedSession extends Omit<StudySessionCache, 'createdAt' | 'expiresAt' | 'vocabulary' | 'cards' | 'logs' | 'srsCardIds'> {
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
export interface SerializedCard extends Omit<Card, 'due' | 'last_review'> {
  due: string,
  last_review?: string
}

/**
 * Serialized ReviewLog for Redis storage
 */
export interface SerializedReviewLog extends Omit<ReviewLog, 'due' | 'review'> {
  due: string
  review: string
}

export const SESSION_TTL_SECONDS = 30 * 60 // 30 minutes
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000

