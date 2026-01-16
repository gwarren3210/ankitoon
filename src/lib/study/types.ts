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

