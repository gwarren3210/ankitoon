import { Tables, Enums } from '@/types/database.types'
import { FsrsCard } from '@/lib/study/fsrs'

/**
 * Card type enum - matches database card_type enum.
 */
export type CardType = Enums<'card_type'>

/**
 * Base study card with common fields.
 * cardType determines whether this is vocabulary or grammar.
 */
export interface StudyCard {
  srsCard: FsrsCard
  srsCardId: string
  cardType: CardType
  // Content - one of these will be populated based on cardType
  vocabulary: Tables<'vocabulary'> | null
  grammar: Tables<'grammar'> | null
  // Unified accessors for display
  term: string           // vocabulary.term or grammar.pattern
  definition: string     // vocabulary.definition or grammar.definition
  // Examples
  chapterExample: string | null
  globalExample: string | null
  displayExample: string | null
}

export interface StudySessionData {
  deckId: string
  cardsStudied: number
  accuracy: number
  timeSpentSeconds: number
  startTime: Date
  endTime: Date
}

// ============================================================================
// Learn Phase Types (Multiple Choice Quiz)
// ============================================================================

/**
 * Tracks progress for a card during the learn phase.
 * Cards must be answered correctly `requiredCorrect` times to graduate.
 */
export interface LearnCardProgress {
  cardId: string
  correctCount: number      // Times answered correctly in a row
  attemptsTotal: number     // Total attempts (for analytics)
}

/**
 * A single answer option in a multiple choice question.
 */
export interface AnswerOption {
  id: string
  text: string
  isCorrect: boolean
}

/**
 * Fallback distractor from user's difficult cards.
 * Used when there aren't enough cards in the session for distractors.
 */
export interface DistractorOption {
  term: string
  definition: string
  difficulty: number
}

/**
 * Progress state returned by useLearnPhase hook.
 */
export interface LearnProgress {
  graduated: number         // Cards that have passed
  total: number             // Total cards in session
  currentCorrect: number    // Current card's correct count
  requiredCorrect: number   // Correct answers needed to graduate
}

/**
 * Feedback shown after answering a question.
 */
export interface LearnFeedback {
  shown: boolean
  isCorrect: boolean
  correctAnswer: string
  selectedAnswer: string
}

/**
 * Extended StudyCard with deckId for learn sessions.
 * Needed for the persist_learn_session RPC call.
 */
export interface LearnCard extends StudyCard {
  deckId: string
}

