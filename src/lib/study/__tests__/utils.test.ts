/**
 * Study Utility Tests
 *
 * Tests utility functions for FSRS state conversions and helpers:
 * - dbStateToFsrsState / fsrsStateToDbState conversions
 * - calculateElapsedDays calculation
 * - dbCardToFsrsCard transformation
 * - shuffleArray Fisher-Yates implementation
 */

import { describe, it, expect, beforeEach, mock, afterEach } from 'bun:test'
import { State } from 'ts-fsrs'
import {
  dbStateToFsrsState,
  fsrsStateToDbState,
  calculateElapsedDays,
  dbCardToFsrsCard,
  shuffleArray
} from '@/lib/study/utils'

describe('study utils', () => {
  describe('dbStateToFsrsState', () => {
    it('converts New to State.New', () => {
      expect(dbStateToFsrsState('New')).toBe(State.New)
    })

    it('converts Learning to State.Learning', () => {
      expect(dbStateToFsrsState('Learning')).toBe(State.Learning)
    })

    it('converts Review to State.Review', () => {
      expect(dbStateToFsrsState('Review')).toBe(State.Review)
    })

    it('converts Relearning to State.Relearning', () => {
      expect(dbStateToFsrsState('Relearning')).toBe(State.Relearning)
    })

    it('defaults to State.New for unknown states', () => {
      expect(dbStateToFsrsState('Unknown')).toBe(State.New)
    })

    it('defaults to State.New for empty string', () => {
      expect(dbStateToFsrsState('')).toBe(State.New)
    })
  })

  describe('fsrsStateToDbState', () => {
    it('converts State.New to New', () => {
      expect(fsrsStateToDbState(State.New)).toBe('New')
    })

    it('converts State.Learning to Learning', () => {
      expect(fsrsStateToDbState(State.Learning)).toBe('Learning')
    })

    it('converts State.Review to Review', () => {
      expect(fsrsStateToDbState(State.Review)).toBe('Review')
    })

    it('converts State.Relearning to Relearning', () => {
      expect(fsrsStateToDbState(State.Relearning)).toBe('Relearning')
    })
  })

  describe('state conversion roundtrip', () => {
    it('New roundtrips correctly', () => {
      const dbState = 'New'
      const fsrsState = dbStateToFsrsState(dbState)
      const backToDb = fsrsStateToDbState(fsrsState)
      expect(backToDb).toBe(dbState)
    })

    it('Learning roundtrips correctly', () => {
      const dbState = 'Learning'
      const fsrsState = dbStateToFsrsState(dbState)
      const backToDb = fsrsStateToDbState(fsrsState)
      expect(backToDb).toBe(dbState)
    })

    it('Review roundtrips correctly', () => {
      const dbState = 'Review'
      const fsrsState = dbStateToFsrsState(dbState)
      const backToDb = fsrsStateToDbState(fsrsState)
      expect(backToDb).toBe(dbState)
    })

    it('Relearning roundtrips correctly', () => {
      const dbState = 'Relearning'
      const fsrsState = dbStateToFsrsState(dbState)
      const backToDb = fsrsStateToDbState(fsrsState)
      expect(backToDb).toBe(dbState)
    })
  })

  describe('calculateElapsedDays', () => {
    it('returns 0 for null lastReview', () => {
      expect(calculateElapsedDays(null)).toBe(0)
    })

    it('returns 0 for today', () => {
      const today = new Date().toISOString()
      expect(calculateElapsedDays(today)).toBe(0)
    })

    it('returns 1 for yesterday', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      expect(calculateElapsedDays(yesterday.toISOString())).toBe(1)
    })

    it('returns 7 for a week ago', () => {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      expect(calculateElapsedDays(weekAgo.toISOString())).toBe(7)
    })

    it('returns 30 for 30 days ago', () => {
      const monthAgo = new Date()
      monthAgo.setDate(monthAgo.getDate() - 30)
      expect(calculateElapsedDays(monthAgo.toISOString())).toBe(30)
    })

    it('handles fractional days by flooring', () => {
      // 1.5 days ago should return 1
      const halfDayAgo = new Date()
      halfDayAgo.setTime(halfDayAgo.getTime() - 1.5 * 24 * 60 * 60 * 1000)
      expect(calculateElapsedDays(halfDayAgo.toISOString())).toBe(1)
    })
  })

  describe('dbCardToFsrsCard', () => {
    const baseCard = {
      id: 'card-1',
      created_at: '2024-01-01T00:00:00Z',
      deck_id: 'deck-1',
      user_id: 'user-1',
      chapter_vocabulary_id: 'cv-1',
      state: 'New',
      due: '2024-01-15T00:00:00Z',
      stability: 1.5,
      difficulty: 5.0,
      scheduled_days: 10,
      learning_steps: 0,
      total_reviews: 5,
      streak_correct: 3,
      streak_incorrect: 2,
      last_reviewed_date: null,
      priority_boost: 0
    }

    it('converts state correctly', () => {
      const card = dbCardToFsrsCard({
        ...baseCard,
        state: 'Learning'
      })
      expect(card.state).toBe(State.Learning)
    })

    it('converts due date to Date object', () => {
      const card = dbCardToFsrsCard(baseCard)
      expect(card.due).toBeInstanceOf(Date)
      expect(card.due.toISOString()).toBe('2024-01-15T00:00:00.000Z')
    })

    it('uses current date when due is null', () => {
      const card = dbCardToFsrsCard({
        ...baseCard,
        due: null
      })
      expect(card.due).toBeInstanceOf(Date)
      // Should be close to now
      const diff = Math.abs(card.due.getTime() - Date.now())
      expect(diff).toBeLessThan(1000) // Within 1 second
    })

    it('copies stability correctly', () => {
      const card = dbCardToFsrsCard({
        ...baseCard,
        stability: 42.5
      })
      expect(card.stability).toBe(42.5)
    })

    it('copies difficulty correctly', () => {
      const card = dbCardToFsrsCard({
        ...baseCard,
        difficulty: 7.3
      })
      expect(card.difficulty).toBe(7.3)
    })

    it('calculates elapsed_days from last_reviewed_date', () => {
      const twoDaysAgo = new Date()
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

      const card = dbCardToFsrsCard({
        ...baseCard,
        last_reviewed_date: twoDaysAgo.toISOString()
      })
      expect(card.elapsed_days).toBe(2)
    })

    it('sets elapsed_days to 0 when no last_reviewed_date', () => {
      const card = dbCardToFsrsCard({
        ...baseCard,
        last_reviewed_date: null
      })
      expect(card.elapsed_days).toBe(0)
    })

    it('copies scheduled_days correctly', () => {
      const card = dbCardToFsrsCard({
        ...baseCard,
        scheduled_days: 14
      })
      expect(card.scheduled_days).toBe(14)
    })

    it('defaults scheduled_days to 0 when null', () => {
      const card = dbCardToFsrsCard({
        ...baseCard,
        scheduled_days: null
      })
      expect(card.scheduled_days).toBe(0)
    })

    it('copies learning_steps correctly', () => {
      const card = dbCardToFsrsCard({
        ...baseCard,
        learning_steps: 3
      })
      expect(card.learning_steps).toBe(3)
    })

    it('defaults learning_steps to 0 when null', () => {
      const card = dbCardToFsrsCard({
        ...baseCard,
        learning_steps: null
      })
      expect(card.learning_steps).toBe(0)
    })

    it('maps total_reviews to reps', () => {
      const card = dbCardToFsrsCard({
        ...baseCard,
        total_reviews: 15
      })
      expect(card.reps).toBe(15)
    })

    it('maps streak_incorrect to lapses', () => {
      const card = dbCardToFsrsCard({
        ...baseCard,
        streak_incorrect: 4
      })
      expect(card.lapses).toBe(4)
    })

    it('converts last_reviewed_date to last_review Date', () => {
      const reviewDate = '2024-01-10T12:30:00Z'
      const card = dbCardToFsrsCard({
        ...baseCard,
        last_reviewed_date: reviewDate
      })
      expect(card.last_review).toBeInstanceOf(Date)
      expect(card.last_review?.toISOString()).toBe('2024-01-10T12:30:00.000Z')
    })

    it('sets last_review to undefined when null', () => {
      const card = dbCardToFsrsCard({
        ...baseCard,
        last_reviewed_date: null
      })
      expect(card.last_review).toBeUndefined()
    })
  })

  describe('shuffleArray', () => {
    it('returns array with same length', () => {
      const arr = [1, 2, 3, 4, 5]
      const shuffled = shuffleArray(arr)
      expect(shuffled.length).toBe(arr.length)
    })

    it('returns array with same elements', () => {
      const arr = [1, 2, 3, 4, 5]
      const shuffled = shuffleArray(arr)
      expect(shuffled.sort()).toEqual(arr.sort())
    })

    it('does not modify original array', () => {
      const arr = [1, 2, 3, 4, 5]
      const original = [...arr]
      shuffleArray(arr)
      expect(arr).toEqual(original)
    })

    it('handles empty array', () => {
      const arr: number[] = []
      const shuffled = shuffleArray(arr)
      expect(shuffled).toEqual([])
    })

    it('handles single element array', () => {
      const arr = [42]
      const shuffled = shuffleArray(arr)
      expect(shuffled).toEqual([42])
    })

    it('handles array with duplicate elements', () => {
      const arr = [1, 1, 2, 2, 3, 3]
      const shuffled = shuffleArray(arr)
      expect(shuffled.sort()).toEqual(arr.sort())
    })

    it('works with object arrays', () => {
      const arr = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const shuffled = shuffleArray(arr)
      expect(shuffled.length).toBe(3)
      // Same object references
      expect(shuffled).toContain(arr[0])
      expect(shuffled).toContain(arr[1])
      expect(shuffled).toContain(arr[2])
    })

    it('produces different orderings (probabilistic)', () => {
      // Run multiple shuffles and check that not all are identical
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const results = new Set<string>()

      for (let i = 0; i < 100; i++) {
        const shuffled = shuffleArray(arr)
        results.add(JSON.stringify(shuffled))
      }

      // With 10 elements, should have many unique orderings
      // (10! = 3,628,800 possible orderings)
      expect(results.size).toBeGreaterThan(50)
    })
  })
})
