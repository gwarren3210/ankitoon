/**
 * Session Serialization Tests
 *
 * Tests the conversion between runtime representation (Maps, Dates)
 * and storage format (Records, ISO strings) for Redis persistence.
 */

import { describe, it, expect } from 'bun:test'
import { State, Rating } from 'ts-fsrs'
import {
  serializeCard,
  deserializeCard,
  serializeReviewLog,
  deserializeReviewLog,
  serializeSession,
  deserializeSession
} from '@/lib/study/sessionSerialization'
import {
  createTestCard,
  createLearningCard,
  createTestReviewLog,
  createTestSession,
  createTestSerializedSession,
  testVocabulary,
  testVocabulary2
} from '@/lib/test-utils'

describe('sessionSerialization', () => {
  describe('serializeCard', () => {
    it('converts due Date to ISO string', () => {
      const card = createTestCard({
        due: new Date('2024-01-15T10:00:00.000Z')
      })

      const serialized = serializeCard(card)

      expect(serialized.due).toBe('2024-01-15T10:00:00.000Z')
      expect(typeof serialized.due).toBe('string')
    })

    it('converts last_review Date to ISO string when present', () => {
      const card = createLearningCard({
        last_review: new Date('2024-01-14T10:00:00.000Z')
      })

      const serialized = serializeCard(card)

      expect(serialized.last_review).toBe('2024-01-14T10:00:00.000Z')
    })

    it('handles undefined last_review', () => {
      const card = createTestCard({ last_review: undefined })

      const serialized = serializeCard(card)

      expect(serialized.last_review).toBeUndefined()
    })

    it('preserves all FSRS card properties', () => {
      const card = createLearningCard({
        stability: 5.5,
        difficulty: 4.2,
        elapsed_days: 3,
        scheduled_days: 7,
        reps: 5,
        lapses: 1,
        state: State.Review
      })

      const serialized = serializeCard(card)

      expect(serialized.stability).toBe(5.5)
      expect(serialized.difficulty).toBe(4.2)
      expect(serialized.elapsed_days).toBe(3)
      expect(serialized.scheduled_days).toBe(7)
      expect(serialized.reps).toBe(5)
      expect(serialized.lapses).toBe(1)
      expect(serialized.state).toBe(State.Review)
    })
  })

  describe('deserializeCard', () => {
    it('converts due ISO string back to Date', () => {
      const serialized = {
        due: '2024-01-15T10:00:00.000Z',
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        state: State.New,
        last_review: undefined
      }

      const card = deserializeCard(serialized)

      expect(card.due).toBeInstanceOf(Date)
      expect(card.due.toISOString()).toBe('2024-01-15T10:00:00.000Z')
    })

    it('converts last_review ISO string back to Date when present', () => {
      const serialized = {
        due: '2024-01-15T10:00:00.000Z',
        stability: 1.5,
        difficulty: 5.0,
        elapsed_days: 0,
        scheduled_days: 1,
        reps: 1,
        lapses: 0,
        state: State.Learning,
        last_review: '2024-01-14T10:00:00.000Z'
      }

      const card = deserializeCard(serialized)

      expect(card.last_review).toBeInstanceOf(Date)
      expect(card.last_review!.toISOString()).toBe('2024-01-14T10:00:00.000Z')
    })

    it('handles undefined last_review', () => {
      const serialized = {
        due: '2024-01-15T10:00:00.000Z',
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        reps: 0,
        lapses: 0,
        state: State.New,
        last_review: undefined
      }

      const card = deserializeCard(serialized)

      expect(card.last_review).toBeUndefined()
    })

    it('roundtrips correctly with serializeCard', () => {
      const original = createLearningCard({
        due: new Date('2024-01-15T10:00:00.000Z'),
        last_review: new Date('2024-01-14T10:00:00.000Z'),
        stability: 2.5,
        difficulty: 4.8
      })

      const serialized = serializeCard(original)
      const deserialized = deserializeCard(serialized)

      expect(deserialized.due.toISOString()).toBe(original.due.toISOString())
      expect(deserialized.last_review!.toISOString()).toBe(
        original.last_review!.toISOString()
      )
      expect(deserialized.stability).toBe(original.stability)
      expect(deserialized.difficulty).toBe(original.difficulty)
      expect(deserialized.state).toBe(original.state)
    })
  })

  describe('serializeReviewLog', () => {
    it('converts due and review Dates to ISO strings', () => {
      const log = createTestReviewLog(Rating.Good, {
        due: new Date('2024-01-15T10:00:00.000Z'),
        review: new Date('2024-01-15T10:30:00.000Z')
      })

      const serialized = serializeReviewLog(log)

      expect(serialized.due).toBe('2024-01-15T10:00:00.000Z')
      expect(serialized.review).toBe('2024-01-15T10:30:00.000Z')
      expect(typeof serialized.due).toBe('string')
      expect(typeof serialized.review).toBe('string')
    })

    it('preserves rating, state, and other properties', () => {
      const log = createTestReviewLog(Rating.Easy, {
        state: State.Review,
        stability: 10.5,
        difficulty: 3.2,
        elapsed_days: 5,
        last_elapsed_days: 3,
        scheduled_days: 14
      })

      const serialized = serializeReviewLog(log)

      expect(serialized.rating).toBe(Rating.Easy)
      expect(serialized.state).toBe(State.Review)
      expect(serialized.stability).toBe(10.5)
      expect(serialized.difficulty).toBe(3.2)
      expect(serialized.elapsed_days).toBe(5)
      expect(serialized.last_elapsed_days).toBe(3)
      expect(serialized.scheduled_days).toBe(14)
    })
  })

  describe('deserializeReviewLog', () => {
    it('converts ISO strings back to Dates', () => {
      const serialized = {
        rating: Rating.Good,
        state: State.Learning,
        due: '2024-01-15T10:00:00.000Z',
        stability: 1.5,
        difficulty: 5.0,
        elapsed_days: 0,
        last_elapsed_days: 0,
        scheduled_days: 1,
        review: '2024-01-15T10:30:00.000Z'
      }

      const log = deserializeReviewLog(serialized)

      expect(log.due).toBeInstanceOf(Date)
      expect(log.review).toBeInstanceOf(Date)
      expect(log.due.toISOString()).toBe('2024-01-15T10:00:00.000Z')
      expect(log.review.toISOString()).toBe('2024-01-15T10:30:00.000Z')
    })

    it('roundtrips correctly with serializeReviewLog', () => {
      const original = createTestReviewLog(Rating.Hard, {
        due: new Date('2024-01-15T10:00:00.000Z'),
        review: new Date('2024-01-15T10:30:00.000Z'),
        stability: 0.8,
        difficulty: 6.5
      })

      const serialized = serializeReviewLog(original)
      const deserialized = deserializeReviewLog(serialized)

      expect(deserialized.due.toISOString()).toBe(original.due.toISOString())
      expect(deserialized.review.toISOString()).toBe(original.review.toISOString())
      expect(deserialized.rating).toBe(original.rating)
      expect(deserialized.stability).toBe(original.stability)
    })
  })

  describe('serializeSession', () => {
    it('converts Maps to Records', () => {
      const session = createTestSession()

      const serialized = serializeSession(session)

      expect(typeof serialized.vocabulary).toBe('object')
      expect(Array.isArray(serialized.vocabulary)).toBe(false)
      expect(serialized.vocabulary['vocab-1']).toEqual(testVocabulary)
      expect(serialized.vocabulary['vocab-2']).toEqual(testVocabulary2)
    })

    it('converts all Date fields to ISO strings', () => {
      const session = createTestSession({
        createdAt: new Date('2024-01-15T10:00:00.000Z'),
        expiresAt: new Date('2024-01-15T10:30:00.000Z')
      })

      const serialized = serializeSession(session)

      expect(typeof serialized.createdAt).toBe('string')
      expect(typeof serialized.expiresAt).toBe('string')
      expect(serialized.createdAt).toBe('2024-01-15T10:00:00.000Z')
      expect(serialized.expiresAt).toBe('2024-01-15T10:30:00.000Z')
    })

    it('serializes cards with Date conversion', () => {
      const session = createTestSession()

      const serialized = serializeSession(session)

      expect(typeof serialized.cards['vocab-1'].due).toBe('string')
      expect(typeof serialized.cards['vocab-2'].due).toBe('string')
    })

    it('handles empty Maps correctly', () => {
      const session = createTestSession({
        vocabulary: new Map(),
        cards: new Map(),
        logs: new Map(),
        srsCardIds: new Map(),
        chapterExamples: new Map()
      })

      const serialized = serializeSession(session)

      expect(Object.keys(serialized.vocabulary)).toHaveLength(0)
      expect(Object.keys(serialized.cards)).toHaveLength(0)
      expect(Object.keys(serialized.logs)).toHaveLength(0)
      expect(Object.keys(serialized.srsCardIds)).toHaveLength(0)
      expect(Object.keys(serialized.chapterExamples)).toHaveLength(0)
    })

    it('handles Maps with multiple entries', () => {
      const session = createTestSession()
      session.logs.set('vocab-1', [
        createTestReviewLog(Rating.Good),
        createTestReviewLog(Rating.Easy)
      ])

      const serialized = serializeSession(session)

      expect(serialized.logs['vocab-1']).toHaveLength(2)
      expect(serialized.logs['vocab-1'][0].rating).toBe(Rating.Good)
      expect(serialized.logs['vocab-1'][1].rating).toBe(Rating.Easy)
    })

    it('preserves scalar fields', () => {
      const session = createTestSession({
        userId: 'custom-user',
        chapterId: 'custom-chapter',
        deckId: 'custom-deck'
      })

      const serialized = serializeSession(session)

      expect(serialized.userId).toBe('custom-user')
      expect(serialized.chapterId).toBe('custom-chapter')
      expect(serialized.deckId).toBe('custom-deck')
    })
  })

  describe('deserializeSession', () => {
    it('converts Records back to Maps', () => {
      const serialized = createTestSerializedSession()

      const session = deserializeSession(serialized)

      expect(session.vocabulary).toBeInstanceOf(Map)
      expect(session.cards).toBeInstanceOf(Map)
      expect(session.logs).toBeInstanceOf(Map)
      expect(session.srsCardIds).toBeInstanceOf(Map)
      expect(session.chapterExamples).toBeInstanceOf(Map)
    })

    it('converts all ISO strings back to Dates', () => {
      const serialized = createTestSerializedSession({
        createdAt: '2024-01-15T10:00:00.000Z',
        expiresAt: '2024-01-15T10:30:00.000Z'
      })

      const session = deserializeSession(serialized)

      expect(session.createdAt).toBeInstanceOf(Date)
      expect(session.expiresAt).toBeInstanceOf(Date)
      expect(session.createdAt.toISOString()).toBe('2024-01-15T10:00:00.000Z')
      expect(session.expiresAt.toISOString()).toBe('2024-01-15T10:30:00.000Z')
    })

    it('deserializes cards with Date conversion', () => {
      const serialized = createTestSerializedSession()

      const session = deserializeSession(serialized)

      const card = session.cards.get('vocab-1')
      expect(card).toBeDefined()
      expect(card!.due).toBeInstanceOf(Date)
    })

    it('handles missing optional fields (srsCardIds, chapterExamples)', () => {
      const serialized = createTestSerializedSession()
      // Simulate older session format without these fields
      const partialSerialized = {
        ...serialized,
        srsCardIds: undefined,
        chapterExamples: undefined
      }

      // Should not throw
      const session = deserializeSession(partialSerialized as any)

      expect(session.srsCardIds).toBeInstanceOf(Map)
      expect(session.chapterExamples).toBeInstanceOf(Map)
      expect(session.srsCardIds.size).toBe(0)
      expect(session.chapterExamples.size).toBe(0)
    })

    it('roundtrips correctly with serializeSession', () => {
      const original = createTestSession()
      original.logs.set('vocab-1', [createTestReviewLog(Rating.Good)])

      const serialized = serializeSession(original)
      const deserialized = deserializeSession(serialized)

      // Check Maps have same entries
      expect(deserialized.vocabulary.size).toBe(original.vocabulary.size)
      expect(deserialized.cards.size).toBe(original.cards.size)
      expect(deserialized.logs.size).toBe(original.logs.size)

      // Check vocabulary entries
      expect(deserialized.vocabulary.get('vocab-1')).toEqual(
        original.vocabulary.get('vocab-1')
      )

      // Check card entries (compare relevant fields)
      const origCard = original.cards.get('vocab-1')!
      const deserCard = deserialized.cards.get('vocab-1')!
      expect(deserCard.state).toBe(origCard.state)
      expect(deserCard.stability).toBe(origCard.stability)
      expect(deserCard.due.toISOString()).toBe(origCard.due.toISOString())

      // Check logs
      expect(deserialized.logs.get('vocab-1')).toHaveLength(1)

      // Check dates
      expect(deserialized.createdAt.toISOString()).toBe(
        original.createdAt.toISOString()
      )
      expect(deserialized.expiresAt.toISOString()).toBe(
        original.expiresAt.toISOString()
      )
    })

    it('deserializes review logs within logs map', () => {
      const serialized = createTestSerializedSession()
      serialized.logs = {
        'vocab-1': [
          {
            rating: Rating.Good,
            state: State.Learning,
            due: '2024-01-15T10:00:00.000Z',
            stability: 1.5,
            difficulty: 5.0,
            elapsed_days: 0,
            last_elapsed_days: 0,
            scheduled_days: 1,
            review: '2024-01-15T10:30:00.000Z'
          }
        ]
      }

      const session = deserializeSession(serialized)

      const logs = session.logs.get('vocab-1')
      expect(logs).toHaveLength(1)
      expect(logs![0].due).toBeInstanceOf(Date)
      expect(logs![0].review).toBeInstanceOf(Date)
      expect(logs![0].rating).toBe(Rating.Good)
    })
  })
})
