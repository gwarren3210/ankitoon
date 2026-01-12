/**
 * Session Data Transform Tests
 *
 * Tests the transformation functions that convert session cache data
 * to API responses and persistence formats.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { State, Rating } from 'ts-fsrs'
import {
  transformSessionToStudyCards,
  createSessionStartResponse,
  collectSessionDataForPersistence,
  calculateSessionStats
} from '@/lib/study/sessionDataTransform'
import {
  createTestSession,
  createTestCard,
  createLearningCard,
  createTestReviewLog,
  testVocabulary,
  testVocabulary2,
  testVocabulary3
} from '@/lib/test-utils'

// Mock logger to prevent console output during tests
mock.module('@/lib/logger', () => ({
  logger: {
    error: mock(() => {}),
    warn: mock(() => {}),
    info: mock(() => {}),
    debug: mock(() => {})
  }
}))

describe('sessionDataTransform', () => {
  describe('transformSessionToStudyCards', () => {
    it('transforms session cache to StudyCard array', () => {
      const session = createTestSession()

      const cards = transformSessionToStudyCards(session)

      expect(cards).toHaveLength(2)
      expect(cards[0].vocabulary).toBeDefined()
      expect(cards[0].srsCard).toBeDefined()
      expect(cards[0].srsCardId).toBeDefined()
    })

    it('includes vocabulary for each card', () => {
      const session = createTestSession()

      const cards = transformSessionToStudyCards(session)

      const vocabIds = cards.map(c => c.vocabulary.id)
      expect(vocabIds).toContain('vocab-1')
      expect(vocabIds).toContain('vocab-2')
    })

    it('includes srsCard with FSRS state', () => {
      const session = createTestSession()
      session.cards.set('vocab-1', createTestCard({ state: State.New }))
      session.cards.set('vocab-2', createLearningCard({ state: State.Learning }))

      const cards = transformSessionToStudyCards(session)

      const newCard = cards.find(c => c.vocabulary.id === 'vocab-1')
      const learningCard = cards.find(c => c.vocabulary.id === 'vocab-2')
      expect(newCard?.srsCard.state).toBe(State.New)
      expect(learningCard?.srsCard.state).toBe(State.Learning)
    })

    it('includes chapterExample from session', () => {
      const session = createTestSession()
      session.chapterExamples.set('vocab-1', '커스텀 예문')

      const cards = transformSessionToStudyCards(session)

      const card = cards.find(c => c.vocabulary.id === 'vocab-1')
      expect(card?.chapterExample).toBe('커스텀 예문')
    })

    it('includes globalExample from vocabulary', () => {
      const session = createTestSession()

      const cards = transformSessionToStudyCards(session)

      const card = cards.find(c => c.vocabulary.id === 'vocab-1')
      expect(card?.globalExample).toBe(testVocabulary.example)
    })

    it('throws if vocabulary not found for card', () => {
      const session = createTestSession()
      session.cards.set('missing-vocab', createTestCard())

      expect(() => transformSessionToStudyCards(session)).toThrow(
        'Vocabulary not found for id: missing-vocab'
      )
    })

    it('throws if srsCardId not found for vocabulary', () => {
      const session = createTestSession()
      session.vocabulary.set('vocab-3', testVocabulary3)
      session.cards.set('vocab-3', createTestCard())
      // Not adding srsCardId for vocab-3

      expect(() => transformSessionToStudyCards(session)).toThrow(
        'SRS card ID not found for vocabulary: vocab-3'
      )
    })

    it('handles null chapterExample', () => {
      const session = createTestSession()
      session.chapterExamples.set('vocab-1', null)

      const cards = transformSessionToStudyCards(session)

      const card = cards.find(c => c.vocabulary.id === 'vocab-1')
      expect(card?.chapterExample).toBeNull()
    })

    it('handles missing chapterExample in map', () => {
      const session = createTestSession()
      session.chapterExamples.delete('vocab-1')

      const cards = transformSessionToStudyCards(session)

      const card = cards.find(c => c.vocabulary.id === 'vocab-1')
      expect(card?.chapterExample).toBeNull()
    })
  })

  describe('createSessionStartResponse', () => {
    it('creates response with correct sessionId and deckId', () => {
      const session = createTestSession({ deckId: 'my-deck' })

      const response = createSessionStartResponse(session, 'my-deck', 10)

      expect(response.sessionId).toBe('my-deck')
      expect(response.deckId).toBe('my-deck')
    })

    it('counts new cards correctly (state === New)', () => {
      const session = createTestSession()
      session.cards.set('vocab-1', createTestCard({ state: State.New }))
      session.cards.set('vocab-2', createTestCard({ state: State.New }))

      const response = createSessionStartResponse(session, 'deck-1', 10)

      expect(response.numNewCards).toBe(2)
    })

    it('counts only new cards, not learning or review', () => {
      const session = createTestSession()
      session.cards.set('vocab-1', createTestCard({ state: State.New }))
      session.cards.set('vocab-2', createLearningCard({ state: State.Learning }))

      const response = createSessionStartResponse(session, 'deck-1', 10)

      expect(response.numNewCards).toBe(1)
    })

    it('includes all cards in response', () => {
      const session = createTestSession()

      const response = createSessionStartResponse(session, 'deck-1', 10)

      expect(response.cards).toHaveLength(2)
    })

    it('includes numCards from parameter', () => {
      const session = createTestSession()

      const response = createSessionStartResponse(session, 'deck-1', 50)

      expect(response.numCards).toBe(50)
    })

    it('includes startTime from session createdAt', () => {
      const createdAt = new Date('2024-01-15T10:00:00Z')
      const session = createTestSession({ createdAt })

      const response = createSessionStartResponse(session, 'deck-1', 10)

      expect(response.startTime).toEqual(createdAt)
    })
  })

  describe('collectSessionDataForPersistence', () => {
    it('collects cards with logs for update', () => {
      const session = createTestSession()
      session.logs.set('vocab-1', [createTestReviewLog(Rating.Good)])
      session.logs.set('vocab-2', [createTestReviewLog(Rating.Easy)])

      const collected = collectSessionDataForPersistence(session)

      expect(collected.cardsToUpdate.size).toBe(2)
      expect(collected.cardsToUpdate.has('vocab-1')).toBe(true)
      expect(collected.cardsToUpdate.has('vocab-2')).toBe(true)
    })

    it('skips cards without logs', () => {
      const session = createTestSession()
      session.logs.set('vocab-1', [createTestReviewLog(Rating.Good)])
      session.logs.set('vocab-2', []) // No logs

      const collected = collectSessionDataForPersistence(session)

      expect(collected.cardsToUpdate.size).toBe(1)
      expect(collected.cardsToUpdate.has('vocab-1')).toBe(true)
      expect(collected.cardsToUpdate.has('vocab-2')).toBe(false)
    })

    it('flattens logs into single array with srsCardId', () => {
      const session = createTestSession()
      session.logs.set('vocab-1', [
        createTestReviewLog(Rating.Good),
        createTestReviewLog(Rating.Easy)
      ])
      session.logs.set('vocab-2', [createTestReviewLog(Rating.Again)])

      const collected = collectSessionDataForPersistence(session)

      expect(collected.logsToPersist).toHaveLength(3)
      expect(collected.logsToPersist[0].srsCardId).toBe('srs-card-1')
      expect(collected.logsToPersist[0].vocabularyId).toBe('vocab-1')
    })

    it('counts total logs correctly', () => {
      const session = createTestSession()
      session.logs.set('vocab-1', [
        createTestReviewLog(Rating.Good),
        createTestReviewLog(Rating.Easy)
      ])
      session.logs.set('vocab-2', [createTestReviewLog(Rating.Again)])

      const collected = collectSessionDataForPersistence(session)

      expect(collected.totalLogs).toBe(3)
    })

    it('counts good ratings (rating >= 3)', () => {
      const session = createTestSession()
      session.logs.set('vocab-1', [
        createTestReviewLog(Rating.Again), // 1
        createTestReviewLog(Rating.Hard),  // 2
        createTestReviewLog(Rating.Good),  // 3
        createTestReviewLog(Rating.Easy)   // 4
      ])

      const collected = collectSessionDataForPersistence(session)

      expect(collected.logsWithGoodRating).toBe(2) // Good and Easy
    })

    it('returns 0 for good ratings when all are bad', () => {
      const session = createTestSession()
      session.logs.set('vocab-1', [
        createTestReviewLog(Rating.Again),
        createTestReviewLog(Rating.Hard)
      ])

      const collected = collectSessionDataForPersistence(session)

      expect(collected.logsWithGoodRating).toBe(0)
    })

    it('throws if srsCardId missing for vocabulary', () => {
      const session = createTestSession()
      session.logs.set('vocab-1', [createTestReviewLog(Rating.Good)])
      session.srsCardIds.delete('vocab-1') // Remove srsCardId

      expect(() => collectSessionDataForPersistence(session)).toThrow(
        'Missing srsCardId for vocabulary in session cache: vocab-1'
      )
    })

    it('handles session with no logs', () => {
      const session = createTestSession()
      // All logs are empty

      const collected = collectSessionDataForPersistence(session)

      expect(collected.cardsToUpdate.size).toBe(0)
      expect(collected.logsToPersist).toHaveLength(0)
      expect(collected.totalLogs).toBe(0)
      expect(collected.logsWithGoodRating).toBe(0)
    })
  })

  describe('calculateSessionStats', () => {
    let mockDateNow: number

    beforeEach(() => {
      // Mock Date.now() for consistent time calculations
      mockDateNow = new Date('2024-01-15T10:10:00Z').getTime()
      const originalDateNow = Date.now
      Date.now = () => mockDateNow
    })

    it('calculates cardsStudied from totalLogs', () => {
      const collectedData = {
        cardsToUpdate: new Map(),
        logsToPersist: [],
        totalLogs: 15,
        logsWithGoodRating: 10
      }

      const stats = calculateSessionStats(
        collectedData,
        new Date('2024-01-15T10:00:00Z')
      )

      expect(stats.cardsStudied).toBe(15)
    })

    it('calculates accuracy as percentage', () => {
      const collectedData = {
        cardsToUpdate: new Map(),
        logsToPersist: [],
        totalLogs: 10,
        logsWithGoodRating: 8
      }

      const stats = calculateSessionStats(
        collectedData,
        new Date('2024-01-15T10:00:00Z')
      )

      expect(stats.accuracy).toBe(80)
    })

    it('returns 0 accuracy for 0 logs', () => {
      const collectedData = {
        cardsToUpdate: new Map(),
        logsToPersist: [],
        totalLogs: 0,
        logsWithGoodRating: 0
      }

      const stats = calculateSessionStats(
        collectedData,
        new Date('2024-01-15T10:00:00Z')
      )

      expect(stats.accuracy).toBe(0)
    })

    it('calculates timeSpentSeconds from session start', () => {
      const startTime = new Date('2024-01-15T10:00:00Z')
      // mockDateNow is 10:10:00Z, so 10 minutes = 600 seconds

      const collectedData = {
        cardsToUpdate: new Map(),
        logsToPersist: [],
        totalLogs: 10,
        logsWithGoodRating: 5
      }

      const stats = calculateSessionStats(collectedData, startTime)

      expect(stats.timeSpentSeconds).toBe(600)
    })

    it('floors partial seconds', () => {
      // Set mockDateNow to be 10 minutes and 500ms after start
      mockDateNow = new Date('2024-01-15T10:00:00Z').getTime() + 600500
      Date.now = () => mockDateNow

      const startTime = new Date('2024-01-15T10:00:00Z')
      const collectedData = {
        cardsToUpdate: new Map(),
        logsToPersist: [],
        totalLogs: 10,
        logsWithGoodRating: 5
      }

      const stats = calculateSessionStats(collectedData, startTime)

      expect(stats.timeSpentSeconds).toBe(600) // Floored from 600.5
    })

    it('handles 100% accuracy', () => {
      const collectedData = {
        cardsToUpdate: new Map(),
        logsToPersist: [],
        totalLogs: 10,
        logsWithGoodRating: 10
      }

      const stats = calculateSessionStats(
        collectedData,
        new Date('2024-01-15T10:00:00Z')
      )

      expect(stats.accuracy).toBe(100)
    })

    it('handles fractional accuracy', () => {
      const collectedData = {
        cardsToUpdate: new Map(),
        logsToPersist: [],
        totalLogs: 3,
        logsWithGoodRating: 1
      }

      const stats = calculateSessionStats(
        collectedData,
        new Date('2024-01-15T10:00:00Z')
      )

      expect(stats.accuracy).toBeCloseTo(33.33, 1)
    })
  })
})
