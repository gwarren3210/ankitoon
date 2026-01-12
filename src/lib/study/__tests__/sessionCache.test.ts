/**
 * Session Cache Tests
 *
 * Tests Redis CRUD operations for study sessions with 30-minute TTL.
 * Uses in-memory Redis mock to simulate cache behavior.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { State, Rating } from 'ts-fsrs'
import { createMockRedis } from '@/lib/test-utils'
import {
  createStudyCard,
  createTestCard,
  createLearningCard,
  createTestReviewLog,
  testVocabulary,
  testVocabulary2
} from '@/lib/test-utils'
import { SESSION_TTL_SECONDS } from '@/lib/study/sessionTypes'

// Create mock Redis client
const mockRedis = createMockRedis()

// Mock Redis client module
mock.module('@/lib/redis/client', () => ({
  getRedisClient: () => Promise.resolve(mockRedis.client)
}))

// Mock logger to prevent console output
mock.module('@/lib/logger', () => ({
  logger: {
    error: mock(() => {}),
    warn: mock(() => {}),
    info: mock(() => {}),
    debug: mock(() => {})
  }
}))

// Import AFTER mocks are set up
const {
  createSession,
  getSession,
  addLog,
  updateCard,
  deleteSession,
  generateSessionId
} = await import('@/lib/study/sessionCache')

describe('sessionCache', () => {
  beforeEach(() => {
    mockRedis.reset()
  })

  describe('createSession', () => {
    it('creates session in Redis with correct key format', async () => {
      const cards = [
        createStudyCard('vocab-1'),
        createStudyCard('vocab-2')
      ]

      await createSession('user-1', 'chapter-1', 'deck-1', cards)

      expect(mockRedis.mocks.setEx).toHaveBeenCalled()
      const call = mockRedis.mocks.setEx.mock.calls[0]
      expect(call[0]).toBe('session:deck-1')
    })

    it('sets TTL to SESSION_TTL_SECONDS (1800)', async () => {
      const cards = [createStudyCard('vocab-1')]

      await createSession('user-1', 'chapter-1', 'deck-1', cards)

      const call = mockRedis.mocks.setEx.mock.calls[0]
      expect(call[1]).toBe(SESSION_TTL_SECONDS)
      expect(call[1]).toBe(1800)
    })

    it('serializes Maps and Dates correctly', async () => {
      const cards = [createStudyCard('vocab-1')]

      await createSession('user-1', 'chapter-1', 'deck-1', cards)

      const call = mockRedis.mocks.setEx.mock.calls[0]
      const stored = JSON.parse(call[2])

      // Should be Record, not Map
      expect(typeof stored.vocabulary).toBe('object')
      expect(Array.isArray(stored.vocabulary)).toBe(false)
      expect(stored.vocabulary['vocab-1']).toBeDefined()

      // Dates should be ISO strings
      expect(typeof stored.createdAt).toBe('string')
      expect(typeof stored.expiresAt).toBe('string')
    })

    it('creates vocabulary map from cards', async () => {
      const cards = [
        createStudyCard('vocab-1', { vocabulary: testVocabulary }),
        createStudyCard('vocab-2', { vocabulary: testVocabulary2 })
      ]

      await createSession('user-1', 'chapter-1', 'deck-1', cards)

      const call = mockRedis.mocks.setEx.mock.calls[0]
      const stored = JSON.parse(call[2])

      expect(stored.vocabulary['vocab-1'].term).toBe('헌터')
      expect(stored.vocabulary['vocab-2'].term).toBe('각성')
    })

    it('creates srsCardIds map from cards', async () => {
      const cards = [
        createStudyCard('vocab-1', { srsCardId: 'srs-123' }),
        createStudyCard('vocab-2', { srsCardId: 'srs-456' })
      ]

      await createSession('user-1', 'chapter-1', 'deck-1', cards)

      const call = mockRedis.mocks.setEx.mock.calls[0]
      const stored = JSON.parse(call[2])

      expect(stored.srsCardIds['vocab-1']).toBe('srs-123')
      expect(stored.srsCardIds['vocab-2']).toBe('srs-456')
    })

    it('initializes empty logs map for each vocabulary', async () => {
      const cards = [
        createStudyCard('vocab-1'),
        createStudyCard('vocab-2')
      ]

      await createSession('user-1', 'chapter-1', 'deck-1', cards)

      const call = mockRedis.mocks.setEx.mock.calls[0]
      const stored = JSON.parse(call[2])

      expect(stored.logs['vocab-1']).toEqual([])
      expect(stored.logs['vocab-2']).toEqual([])
    })

    it('throws on Redis error', async () => {
      mockRedis.setOperationError(new Error('Redis connection failed'))
      const cards = [createStudyCard('vocab-1')]

      await expect(
        createSession('user-1', 'chapter-1', 'deck-1', cards)
      ).rejects.toThrow('Redis connection failed')
    })

    it('stores userId, chapterId, and deckId', async () => {
      const cards = [createStudyCard('vocab-1')]

      await createSession('my-user', 'my-chapter', 'my-deck', cards)

      const call = mockRedis.mocks.setEx.mock.calls[0]
      const stored = JSON.parse(call[2])

      expect(stored.userId).toBe('my-user')
      expect(stored.chapterId).toBe('my-chapter')
      expect(stored.deckId).toBe('my-deck')
    })
  })

  describe('getSession', () => {
    it('returns session from Redis if exists', async () => {
      const cards = [createStudyCard('vocab-1')]
      await createSession('user-1', 'chapter-1', 'deck-1', cards)

      const session = await getSession('deck-1')

      expect(session).not.toBeNull()
      expect(session!.userId).toBe('user-1')
      expect(session!.chapterId).toBe('chapter-1')
      expect(session!.deckId).toBe('deck-1')
    })

    it('returns null if session not found', async () => {
      const session = await getSession('nonexistent-deck')

      expect(session).toBeNull()
    })

    it('deserializes Maps and Dates correctly', async () => {
      const cards = [createStudyCard('vocab-1')]
      await createSession('user-1', 'chapter-1', 'deck-1', cards)

      const session = await getSession('deck-1')

      expect(session!.vocabulary).toBeInstanceOf(Map)
      expect(session!.cards).toBeInstanceOf(Map)
      expect(session!.logs).toBeInstanceOf(Map)
      expect(session!.srsCardIds).toBeInstanceOf(Map)
      expect(session!.createdAt).toBeInstanceOf(Date)
      expect(session!.expiresAt).toBeInstanceOf(Date)
    })

    it('returns null and deletes session if expired', async () => {
      // Create session with already expired timestamp
      const expiredSession = {
        userId: 'user-1',
        chapterId: 'chapter-1',
        deckId: 'deck-1',
        vocabulary: { 'vocab-1': testVocabulary },
        cards: { 'vocab-1': { due: '2024-01-15T10:00:00Z', stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0, reps: 0, lapses: 0, state: State.New } },
        logs: { 'vocab-1': [] },
        srsCardIds: { 'vocab-1': 'srs-1' },
        chapterExamples: { 'vocab-1': null },
        createdAt: '2024-01-15T10:00:00Z',
        expiresAt: '2024-01-15T10:00:00Z' // Already expired
      }
      mockRedis.setDirectly('session:deck-1', JSON.stringify(expiredSession))

      const session = await getSession('deck-1')

      expect(session).toBeNull()
      expect(mockRedis.mocks.del).toHaveBeenCalledWith('session:deck-1')
    })

    it('deletes session on JSON parse error', async () => {
      mockRedis.setDirectly('session:deck-1', 'invalid json {{{')

      const session = await getSession('deck-1')

      expect(session).toBeNull()
      expect(mockRedis.mocks.del).toHaveBeenCalledWith('session:deck-1')
    })

    it('throws on Redis error', async () => {
      mockRedis.setOperationError(new Error('Redis timeout'))

      await expect(getSession('deck-1')).rejects.toThrow('Redis timeout')
    })
  })

  describe('addLog', () => {
    beforeEach(async () => {
      const cards = [createStudyCard('vocab-1'), createStudyCard('vocab-2')]
      await createSession('user-1', 'chapter-1', 'deck-1', cards)
      mockRedis.mocks.setEx.mockClear()
    })

    it('appends log to existing logs array', async () => {
      const log = createTestReviewLog(Rating.Good)

      await addLog('deck-1', 'vocab-1', log)

      const session = await getSession('deck-1')
      expect(session!.logs.get('vocab-1')).toHaveLength(1)
      expect(session!.logs.get('vocab-1')![0].rating).toBe(Rating.Good)
    })

    it('appends multiple logs correctly', async () => {
      await addLog('deck-1', 'vocab-1', createTestReviewLog(Rating.Good))
      await addLog('deck-1', 'vocab-1', createTestReviewLog(Rating.Easy))

      const session = await getSession('deck-1')
      expect(session!.logs.get('vocab-1')).toHaveLength(2)
    })

    it('refreshes session TTL', async () => {
      const log = createTestReviewLog(Rating.Good)

      await addLog('deck-1', 'vocab-1', log)

      expect(mockRedis.mocks.setEx).toHaveBeenCalled()
      const call = mockRedis.mocks.setEx.mock.calls[0]
      expect(call[1]).toBe(SESSION_TTL_SECONDS)
    })

    it('throws if session not found', async () => {
      const log = createTestReviewLog(Rating.Good)

      await expect(
        addLog('nonexistent-deck', 'vocab-1', log)
      ).rejects.toThrow('Session not found or expired')
    })

    it('initializes empty array if no logs exist for vocabulary', async () => {
      // vocab-2 should have empty logs array initially
      const log = createTestReviewLog(Rating.Good)

      await addLog('deck-1', 'vocab-2', log)

      const session = await getSession('deck-1')
      expect(session!.logs.get('vocab-2')).toHaveLength(1)
    })

    it('updates expiresAt timestamp', async () => {
      const sessionBefore = await getSession('deck-1')
      const expiresBefore = sessionBefore!.expiresAt.getTime()

      // Wait a tiny bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10))

      await addLog('deck-1', 'vocab-1', createTestReviewLog(Rating.Good))

      const sessionAfter = await getSession('deck-1')
      const expiresAfter = sessionAfter!.expiresAt.getTime()

      expect(expiresAfter).toBeGreaterThan(expiresBefore)
    })
  })

  describe('updateCard', () => {
    beforeEach(async () => {
      const cards = [createStudyCard('vocab-1'), createStudyCard('vocab-2')]
      await createSession('user-1', 'chapter-1', 'deck-1', cards)
      mockRedis.mocks.setEx.mockClear()
    })

    it('updates card in session cards map', async () => {
      const updatedCard = createLearningCard({
        state: State.Learning,
        stability: 5.0,
        reps: 3
      })

      await updateCard('deck-1', 'vocab-1', updatedCard)

      const session = await getSession('deck-1')
      const card = session!.cards.get('vocab-1')
      expect(card!.state).toBe(State.Learning)
      expect(card!.stability).toBe(5.0)
      expect(card!.reps).toBe(3)
    })

    it('refreshes session TTL', async () => {
      const updatedCard = createLearningCard()

      await updateCard('deck-1', 'vocab-1', updatedCard)

      expect(mockRedis.mocks.setEx).toHaveBeenCalled()
      const call = mockRedis.mocks.setEx.mock.calls[0]
      expect(call[1]).toBe(SESSION_TTL_SECONDS)
    })

    it('throws if session not found', async () => {
      const updatedCard = createLearningCard()

      await expect(
        updateCard('nonexistent-deck', 'vocab-1', updatedCard)
      ).rejects.toThrow('Session not found or expired')
    })

    it('preserves other cards in session', async () => {
      const updatedCard = createLearningCard({ stability: 10.0 })

      await updateCard('deck-1', 'vocab-1', updatedCard)

      const session = await getSession('deck-1')
      expect(session!.cards.has('vocab-2')).toBe(true)
      // vocab-2 should be unchanged
      expect(session!.cards.get('vocab-2')!.stability).not.toBe(10.0)
    })

    it('updates expiresAt timestamp', async () => {
      const sessionBefore = await getSession('deck-1')
      const expiresBefore = sessionBefore!.expiresAt.getTime()

      await new Promise(resolve => setTimeout(resolve, 10))

      await updateCard('deck-1', 'vocab-1', createLearningCard())

      const sessionAfter = await getSession('deck-1')
      const expiresAfter = sessionAfter!.expiresAt.getTime()

      expect(expiresAfter).toBeGreaterThan(expiresBefore)
    })
  })

  describe('deleteSession', () => {
    beforeEach(async () => {
      const cards = [createStudyCard('vocab-1')]
      await createSession('user-1', 'chapter-1', 'deck-1', cards)
      mockRedis.mocks.del.mockClear()
    })

    it('deletes session from Redis', async () => {
      await deleteSession('deck-1')

      expect(mockRedis.mocks.del).toHaveBeenCalledWith('session:deck-1')
    })

    it('returns deleted session data', async () => {
      const session = await deleteSession('deck-1')

      expect(session).not.toBeNull()
      expect(session!.userId).toBe('user-1')
      expect(session!.deckId).toBe('deck-1')
    })

    it('returns null if session not found', async () => {
      const session = await deleteSession('nonexistent-deck')

      expect(session).toBeNull()
    })

    it('session is no longer retrievable after deletion', async () => {
      await deleteSession('deck-1')

      const session = await getSession('deck-1')
      expect(session).toBeNull()
    })
  })

  describe('generateSessionId', () => {
    it('generates unique session IDs', () => {
      const id1 = generateSessionId()
      const id2 = generateSessionId()

      expect(id1).not.toBe(id2)
    })

    it('follows format: session_{timestamp}_{random}', () => {
      const id = generateSessionId()

      expect(id).toMatch(/^session_\d+_[a-z0-9]+$/)
    })

    it('includes timestamp component', () => {
      const before = Date.now()
      const id = generateSessionId()
      const after = Date.now()

      const parts = id.split('_')
      const timestamp = parseInt(parts[1], 10)

      expect(timestamp).toBeGreaterThanOrEqual(before)
      expect(timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('TTL behavior', () => {
    it('session expires after TTL_SECONDS', async () => {
      const cards = [createStudyCard('vocab-1')]
      await createSession('user-1', 'chapter-1', 'deck-1', cards)

      // Simulate time passing beyond TTL
      mockRedis.advanceTime(SESSION_TTL_SECONDS + 1)

      const session = await getSession('deck-1')
      expect(session).toBeNull()
    })

    it('TTL is refreshed by addLog', async () => {
      const cards = [createStudyCard('vocab-1')]
      await createSession('user-1', 'chapter-1', 'deck-1', cards)

      // Advance time but not beyond TTL
      mockRedis.advanceTime(SESSION_TTL_SECONDS - 100)

      // Add a log to refresh TTL
      await addLog('deck-1', 'vocab-1', createTestReviewLog(Rating.Good))

      // Advance time again
      mockRedis.advanceTime(SESSION_TTL_SECONDS - 100)

      // Session should still exist because TTL was refreshed
      const session = await getSession('deck-1')
      expect(session).not.toBeNull()
    })

    it('TTL is refreshed by updateCard', async () => {
      const cards = [createStudyCard('vocab-1')]
      await createSession('user-1', 'chapter-1', 'deck-1', cards)

      // Advance time but not beyond TTL
      mockRedis.advanceTime(SESSION_TTL_SECONDS - 100)

      // Update card to refresh TTL
      await updateCard('deck-1', 'vocab-1', createLearningCard())

      // Advance time again
      mockRedis.advanceTime(SESSION_TTL_SECONDS - 100)

      // Session should still exist
      const session = await getSession('deck-1')
      expect(session).not.toBeNull()
    })
  })
})
