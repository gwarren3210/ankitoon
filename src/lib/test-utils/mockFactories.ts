/**
 * Mock Factories - Factory Functions for Test Objects
 *
 * Provides factory functions to create test objects with sensible defaults.
 * Use these to reduce boilerplate in tests while keeping test data consistent.
 */

import { State, Rating, Card, ReviewLog } from 'ts-fsrs'
import { Tables } from '@/types/database.types'
import { StudySessionCache } from '@/lib/study/sessionTypes'
import {
  testVocabulary,
  testVocabulary2,
  createTestCard,
  createTestReviewLog
} from './fixtures'

/**
 * StudyCard as returned by getStudyCards RPC.
 * This is the shape used throughout the study session flow.
 */
export interface StudyCard {
  srsCard: Card
  vocabulary: Tables<'vocabulary'>
  chapterExample: string | null
  globalExample: string | null
  srsCardId: string
}

/**
 * Creates a StudyCard for testing.
 * Input: vocabulary ID and optional overrides
 * Output: StudyCard object
 */
export function createStudyCard(
  vocabularyId: string = 'vocab-1',
  overrides: Partial<StudyCard> = {}
): StudyCard {
  const vocabulary = vocabularyId === 'vocab-1' ? testVocabulary : testVocabulary2

  return {
    srsCard: createTestCard(),
    vocabulary,
    chapterExample: vocabulary.example,
    globalExample: null,
    srsCardId: `srs-${vocabularyId}`,
    ...overrides
  }
}

/**
 * Creates multiple StudyCards for testing.
 * Input: count and optional factory function
 * Output: Array of StudyCard objects
 */
export function createStudyCards(
  count: number,
  factory?: (index: number) => Partial<StudyCard>
): StudyCard[] {
  return Array.from({ length: count }, (_, i) => {
    const vocabId = `vocab-${i + 1}`
    const overrides = factory ? factory(i) : {}
    return createStudyCard(vocabId, {
      vocabulary: {
        id: vocabId,
        term: `테스트${i + 1}`,
        definition: `test word ${i + 1}`,
        example: `예문 ${i + 1}`,
        sense_key: `test${i + 1}::test`,
        created_at: '2024-01-01T00:00:00Z'
      },
      srsCardId: `srs-card-${i + 1}`,
      ...overrides
    })
  })
}

/**
 * Creates a SessionStartResponse as returned by startStudySession.
 * Input: optional overrides
 * Output: SessionStartResponse object
 */
export function createSessionStartResponse(overrides: Partial<{
  sessionId: string
  deckId: string
  cards: StudyCard[]
  newCardsCount: number
  startTime: Date
}> = {}) {
  const cards = overrides.cards || [createStudyCard('vocab-1'), createStudyCard('vocab-2')]
  return {
    sessionId: 'session-1',
    deckId: 'deck-1',
    cards,
    newCardsCount: cards.filter(c => c.srsCard.state === State.New).length,
    startTime: new Date('2024-01-15T10:00:00Z'),
    ...overrides
  }
}

/**
 * Creates a SessionEndStats as returned by endStudySession.
 * Input: optional overrides
 * Output: SessionEndStats object
 */
export function createSessionEndStats(overrides: Partial<{
  cardsStudied: number
  accuracy: number
  timeSpentSeconds: number
}> = {}) {
  return {
    cardsStudied: 10,
    accuracy: 85,
    timeSpentSeconds: 300,
    ...overrides
  }
}

/**
 * Creates a deck row as returned from database.
 * Input: optional overrides
 * Output: Deck database row
 */
export function createDeckRow(overrides?: Partial<Tables<'user_chapter_decks'>>) {
  return {
    id: 'deck-1',
    user_id: 'test-user-id',
    chapter_id: 'chapter-1',
    name: 'Chapter 1',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides
  } as Tables<'user_chapter_decks'>
}

/**
 * Creates a chapter row as returned from database.
 * Input: optional overrides
 * Output: Chapter database row
 */
export function createChapterRow(overrides?: Partial<Tables<'chapters'>>) {
  return {
    id: 'chapter-1',
    series_id: 'series-1',
    chapter_number: 1,
    title: 'Chapter 1: The Beginning',
    created_at: '2024-01-01T00:00:00Z',
    external_url: null,
    ...overrides
  } as Tables<'chapters'>
}

/**
 * Creates an SRS card row as returned from database.
 * Input: optional overrides
 * Output: SRS card database row
 */
export function createSrsCardRow(overrides: Partial<{
  id: string
  user_id: string
  vocabulary_id: string
  deck_id: string
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  reps: number
  lapses: number
  state: string
  last_review: string | null
}> = {}) {
  return {
    id: 'srs-card-1',
    user_id: 'test-user-id',
    vocabulary_id: 'vocab-1',
    deck_id: 'deck-1',
    due: '2024-01-15T10:00:00Z',
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: 'New',
    last_review: null,
    ...overrides
  }
}

/**
 * Creates a review log entry for batch persistence.
 * Input: optional overrides
 * Output: Review log entry with srsCardId
 */
export function createReviewLogEntry(overrides: Partial<{
  srsCardId: string
  log: ReviewLog
}> = {}) {
  return {
    srsCardId: 'srs-card-1',
    log: createTestReviewLog(),
    ...overrides
  }
}

/**
 * Creates validation result as returned by validateChapterAndGetCounts.
 * Input: optional overrides
 * Output: Validation result object
 */
export function createValidationResult(overrides: Partial<{
  isValid: boolean
  error: 'chapter_not_found' | 'no_vocabulary' | 'query_error' | null
  errorMessage: string | null
  totalCardsCount: number
  existingCardsCount: number
}> = {}) {
  return {
    isValid: true,
    error: null,
    errorMessage: null,
    totalCardsCount: 10,
    existingCardsCount: 5,
    ...overrides
  }
}

/**
 * Creates get_study_cards RPC response data.
 * Input: count and optional card state
 * Output: Array matching RPC response format
 */
export function createGetStudyCardsResponse(
  count: number = 5,
  state: 'New' | 'Learning' | 'Review' | 'Relearning' = 'New'
) {
  return Array.from({ length: count }, (_, i) => ({
    srs_card_id: `srs-card-${i + 1}`,
    vocabulary_id: `vocab-${i + 1}`,
    term: `테스트${i + 1}`,
    definition: `test ${i + 1}`,
    example: `예문 ${i + 1}`,
    sense_key: `test${i + 1}::test`,
    chapter_example: `챕터 예문 ${i + 1}`,
    due: '2024-01-15T10:00:00Z',
    stability: state === 'New' ? 0 : 5,
    difficulty: state === 'New' ? 0 : 4.5,
    elapsed_days: 0,
    scheduled_days: state === 'New' ? 0 : 3,
    reps: state === 'New' ? 0 : 2,
    lapses: 0,
    state,
    last_review: state === 'New' ? null : '2024-01-12T10:00:00Z'
  }))
}

/**
 * Creates persist_session_reviews RPC parameters.
 * Input: card updates and logs
 * Output: Object matching RPC parameter format
 */
export function createPersistSessionParams(overrides: Partial<{
  p_user_id: string
  p_deck_id: string
  p_card_updates: Array<{
    vocabulary_id: string
    due: string
    stability: number
    difficulty: number
    elapsed_days: number
    scheduled_days: number
    reps: number
    lapses: number
    state: string
    last_review: string | null
    rating: string
  }>
  p_review_logs: Array<{
    srs_card_id: string
    rating: string
    state: string
    due: string
    stability: number
    difficulty: number
    elapsed_days: number
    last_elapsed_days: number
    scheduled_days: number
    review: string
  }>
}> = {}) {
  return {
    p_user_id: 'test-user-id',
    p_deck_id: 'deck-1',
    p_card_updates: [],
    p_review_logs: [],
    ...overrides
  }
}
