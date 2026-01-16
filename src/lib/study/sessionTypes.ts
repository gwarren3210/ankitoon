/**
 * Study Session Type Definitions
 *
 * Defines types for the dual-storage session pattern:
 * - StudySessionCache: In-memory representation (uses Maps for efficiency)
 * - SerializedSession: JSON-safe format for Redis (uses Records)
 *
 * SESSION_TTL_SECONDS (30 min) - How long inactive sessions live in Redis
 *
 * For architecture overview, see sessionService.ts
 */

import { Card, ReviewLog } from 'ts-fsrs'
import { Tables } from '@/types/database.types'

/**
 * Study session cache interface.
 * Stores both vocabulary and grammar cards.
 * Card ID (key) is either vocabulary.id or grammar.id depending on card type.
 */
export interface StudySessionCache {
  userId: string
  chapterId: string
  deckId: string
  isChapterCompleted: boolean
  vocabulary: Map<string, Tables<'vocabulary'> | null>
  grammar: Map<string, Tables<'grammar'> | null>
  cards: Map<string, Card>
  logs: Map<string, ReviewLog[]>
  srsCardIds: Map<string, string>
  chapterExamples: Map<string, string | null>
  createdAt: Date
  expiresAt: Date
}

/**
 * Serialized session data for Redis storage
 */
export interface SerializedSession extends Omit<StudySessionCache, 'createdAt' | 'expiresAt' | 'vocabulary' | 'grammar' | 'cards' | 'logs' | 'srsCardIds' | 'chapterExamples'> {
  vocabulary: Record<string, Tables<'vocabulary'> | null>
  grammar: Record<string, Tables<'grammar'> | null>
  cards: Record<string, SerializedCard>
  logs: Record<string, SerializedReviewLog[]>
  srsCardIds: Record<string, string>
  chapterExamples: Record<string, string | null>
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

