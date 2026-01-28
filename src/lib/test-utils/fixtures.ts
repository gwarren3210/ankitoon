/**
 * Test Fixtures - Shared Test Data
 *
 * Provides realistic test data for study session tests.
 * All data uses Korean vocabulary from webtoons for authenticity.
 */

import { State, Rating, Card, ReviewLog } from 'ts-fsrs'
import { Tables } from '@/types/database.types'
import { StudySessionCache, SerializedSession } from '@/lib/study/sessionTypes'

/**
 * Test vocabulary item (Korean: hunter)
 */
export const testVocabulary: Tables<'vocabulary'> = {
  id: 'vocab-1',
  term: '헌터',
  definition: 'hunter',
  example: '그는 강력한 헌터다',
  sense_key: 'heonteo::hunter',
  created_at: '2024-01-01T00:00:00Z'
}

/**
 * Second test vocabulary item (Korean: awakening)
 */
export const testVocabulary2: Tables<'vocabulary'> = {
  id: 'vocab-2',
  term: '각성',
  definition: 'awakening',
  example: '각성 후 그의 능력이 변했다',
  sense_key: 'gakseong::awakening',
  created_at: '2024-01-01T00:00:00Z'
}

/**
 * Third test vocabulary item (Korean: dungeon)
 */
export const testVocabulary3: Tables<'vocabulary'> = {
  id: 'vocab-3',
  term: '던전',
  definition: 'dungeon',
  example: '던전 안은 어둡고 위험했다',
  sense_key: 'deonjeon::dungeon',
  created_at: '2024-01-01T00:00:00Z'
}

/**
 * Creates a fresh FSRS Card for testing.
 * Input: Optional overrides
 * Output: Card object
 */
export function createTestCard(overrides: Partial<Card> = {}): Card {
  return {
    due: new Date('2024-01-15T10:00:00Z'),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: State.New,
    last_review: undefined,
    ...overrides
  }
}

/**
 * Creates an FSRS Card in Learning state.
 * Input: Optional overrides
 * Output: Card object in Learning state
 */
export function createLearningCard(overrides: Partial<Card> = {}): Card {
  return createTestCard({
    state: State.Learning,
    stability: 1.5,
    difficulty: 5.0,
    reps: 1,
    last_review: new Date('2024-01-14T10:00:00Z'),
    ...overrides
  })
}

/**
 * Creates an FSRS Card in Review state.
 * Input: Optional overrides
 * Output: Card object in Review state
 */
export function createReviewCard(overrides: Partial<Card> = {}): Card {
  return createTestCard({
    state: State.Review,
    stability: 10.0,
    difficulty: 4.5,
    reps: 5,
    elapsed_days: 3,
    scheduled_days: 7,
    last_review: new Date('2024-01-12T10:00:00Z'),
    ...overrides
  })
}

/**
 * Creates a test ReviewLog.
 * Input: Rating and optional overrides
 * Output: ReviewLog object
 */
export function createTestReviewLog(
  rating: Rating = Rating.Good,
  overrides: Partial<ReviewLog> = {}
): ReviewLog {
  return {
    rating,
    state: State.Learning,
    due: new Date('2024-01-15T10:00:00Z'),
    stability: 1.5,
    difficulty: 5.0,
    elapsed_days: 0,
    last_elapsed_days: 0,
    scheduled_days: 1,
    learning_steps: 0,
    review: new Date('2024-01-15T10:30:00Z'),
    ...overrides
  }
}

/**
 * Creates a StudySessionCache for testing.
 * Input: Optional overrides
 * Output: StudySessionCache object
 */
export function createTestSession(
  overrides: Partial<StudySessionCache> = {}
): StudySessionCache {
  const now = new Date('2024-01-15T10:00:00Z')
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000) // 30 minutes

  return {
    userId: 'test-user-id',
    chapterId: 'chapter-1',
    deckId: 'deck-1',
    isChapterCompleted: false,
    vocabulary: new Map([
      ['vocab-1', testVocabulary],
      ['vocab-2', testVocabulary2]
    ]),
    grammar: new Map(),
    cards: new Map([
      ['vocab-1', createTestCard()],
      ['vocab-2', createLearningCard()]
    ]),
    logs: new Map([
      ['vocab-1', []],
      ['vocab-2', []]
    ]),
    srsCardIds: new Map([
      ['vocab-1', 'srs-card-1'],
      ['vocab-2', 'srs-card-2']
    ]),
    chapterExamples: new Map([
      ['vocab-1', '그는 강력한 헌터다'],
      ['vocab-2', '각성 후 그의 능력이 변했다']
    ]),
    createdAt: now,
    expiresAt,
    ...overrides
  }
}

/**
 * Creates a SerializedSession for testing Redis storage.
 * Input: Optional overrides
 * Output: SerializedSession object
 */
export function createTestSerializedSession(
  overrides: Partial<SerializedSession> = {}
): SerializedSession {
  return {
    userId: 'test-user-id',
    chapterId: 'chapter-1',
    deckId: 'deck-1',
    isChapterCompleted: false,
    vocabulary: {
      'vocab-1': testVocabulary,
      'vocab-2': testVocabulary2
    },
    grammar: {},
    cards: {
      'vocab-1': {
        due: '2024-01-15T10:00:00.000Z',
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        learning_steps: 0,
        reps: 0,
        lapses: 0,
        state: State.New,
        last_review: undefined
      },
      'vocab-2': {
        due: '2024-01-15T10:00:00.000Z',
        stability: 1.5,
        difficulty: 5.0,
        elapsed_days: 0,
        scheduled_days: 0,
        learning_steps: 0,
        reps: 1,
        lapses: 0,
        state: State.Learning,
        last_review: '2024-01-14T10:00:00.000Z'
      }
    },
    logs: {
      'vocab-1': [],
      'vocab-2': []
    },
    srsCardIds: {
      'vocab-1': 'srs-card-1',
      'vocab-2': 'srs-card-2'
    },
    chapterExamples: {
      'vocab-1': '그는 강력한 헌터다',
      'vocab-2': '각성 후 그의 능력이 변했다'
    },
    createdAt: '2024-01-15T10:00:00.000Z',
    expiresAt: '2024-01-15T10:30:00.000Z',
    ...overrides
  }
}

/**
 * Test user IDs for authentication testing
 */
export const testUserIds = {
  primary: 'test-user-id',
  secondary: 'test-user-2',
  admin: 'admin-user-id',
  unauthorized: 'unauthorized-user-id'
}

/**
 * Test chapter/deck IDs
 */
export const testIds = {
  chapter1: 'chapter-1',
  chapter2: 'chapter-2',
  deck1: 'deck-1',
  deck2: 'deck-2',
  session1: 'session-1',
  srsCard1: 'srs-card-1',
  srsCard2: 'srs-card-2'
}
