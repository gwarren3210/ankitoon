/**
 * Session Service Tests
 *
 * Tests the main orchestration layer for study sessions.
 * Verifies start/end session flows, error handling, and progress updates.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { State } from 'ts-fsrs'
import {
  createMockSupabase,
  createStudyCards,
  createTestSession,
  createTestReviewLog
} from '@/lib/test-utils'

// Track current mock supabase for createClient mock
let mockSupabase: ReturnType<typeof createMockSupabase>

// Mock all dependencies
const mockGetOrCreateDeck = mock(() => Promise.resolve({ id: 'deck-1' }))
const mockValidateChapterAndGetCounts = mock(() => Promise.resolve({
  success: true,
  data: { existingCardsCount: 0, totalCardsCount: 10 }
}))
const mockGetChapterSeriesId = mock(() => Promise.resolve('series-1'))
const mockInitializeChapterCards = mock(() => Promise.resolve(10))
const mockGetStudyCards = mock(() => Promise.resolve(createStudyCards(5)))
const mockCreateSession = mock(() => Promise.resolve())
const mockGetSession = mock(() => Promise.resolve(createTestSession()))
const mockDeleteSession = mock(() => Promise.resolve(createTestSession()))
const mockPersistSessionReviews = mock(() => Promise.resolve())
const mockCreateStudySession = mock(() => Promise.resolve())
const mockUpdateChapterProgress = mock(() => Promise.resolve())
const mockUpdateSeriesProgress = mock(() => Promise.resolve())

mock.module('@/lib/study/deckManagement', () => ({
  getOrCreateDeck: mockGetOrCreateDeck
}))

mock.module('@/lib/study/chapterQueries', () => ({
  validateChapterAndGetCounts: mockValidateChapterAndGetCounts,
  getChapterSeriesId: mockGetChapterSeriesId
}))

mock.module('@/lib/study/initialization', () => ({
  initializeChapterCards: mockInitializeChapterCards
}))

mock.module('@/lib/study/cardRetrieval', () => ({
  getStudyCards: mockGetStudyCards,
  selectDisplayExample: (chapterExample: string | null, globalExample: string | null, isChapterCompleted: boolean) => {
    if (isChapterCompleted) return chapterExample ?? globalExample
    return globalExample
  }
}))

mock.module('@/lib/study/sessionCache', () => ({
  createSession: mockCreateSession,
  getSession: mockGetSession,
  deleteSession: mockDeleteSession
}))

mock.module('@/lib/study/batchCardUpdates', () => ({
  persistSessionReviews: mockPersistSessionReviews
}))

mock.module('@/lib/study/sessions', () => ({
  createStudySession: mockCreateStudySession
}))

mock.module('@/lib/study/progress', () => ({
  updateChapterProgress: mockUpdateChapterProgress,
  updateSeriesProgress: mockUpdateSeriesProgress
}))

mock.module('@/lib/logger', () => ({
  logger: {
    error: mock(() => {}),
    warn: mock(() => {}),
    info: mock(() => {}),
    debug: mock(() => {})
  }
}))

// Mock createClient to return our mock supabase
mock.module('@/lib/supabase/server', () => ({
  createClient: mock(async () => mockSupabase.client)
}))

// Import AFTER mocks
const { startStudySession, endStudySession } = await import(
  '@/lib/study/sessionService'
)

describe('sessionService', () => {
  beforeEach(() => {
    mockSupabase = createMockSupabase()

    // Clear all mock call counts
    mockGetOrCreateDeck.mockClear()
    mockValidateChapterAndGetCounts.mockClear()
    mockGetChapterSeriesId.mockClear()
    mockInitializeChapterCards.mockClear()
    mockGetStudyCards.mockClear()
    mockCreateSession.mockClear()
    mockGetSession.mockClear()
    mockDeleteSession.mockClear()
    mockPersistSessionReviews.mockClear()
    mockCreateStudySession.mockClear()
    mockUpdateChapterProgress.mockClear()
    mockUpdateSeriesProgress.mockClear()

    // Reset all mocks to default behavior
    mockGetOrCreateDeck.mockImplementation(() => Promise.resolve({ id: 'deck-1' }))
    mockValidateChapterAndGetCounts.mockImplementation(() => Promise.resolve({
      success: true,
      data: { existingCardsCount: 0, totalCardsCount: 10 }
    }))
    mockGetChapterSeriesId.mockImplementation(() => Promise.resolve('series-1'))
    mockInitializeChapterCards.mockImplementation(() => Promise.resolve(10))
    mockGetStudyCards.mockImplementation(() => Promise.resolve(createStudyCards(5)))

    // Default: no existing session
    let sessionCreated = false
    mockGetSession.mockImplementation(() => {
      if (sessionCreated) {
        return Promise.resolve(createTestSession())
      }
      return Promise.resolve(null)
    })
    mockCreateSession.mockImplementation(() => {
      sessionCreated = true
      return Promise.resolve()
    })

    mockDeleteSession.mockImplementation(() => Promise.resolve(createTestSession()))
    mockPersistSessionReviews.mockImplementation(() => Promise.resolve())
    mockCreateStudySession.mockImplementation(() => Promise.resolve())
    mockUpdateChapterProgress.mockImplementation(() => Promise.resolve())
    mockUpdateSeriesProgress.mockImplementation(() => Promise.resolve())
  })

  describe('startStudySession', () => {
    describe('error cases', () => {
      it('returns deck_creation_failed on getOrCreateDeck error', async () => {
        mockGetOrCreateDeck.mockImplementation(() => {
          throw new Error('Database connection failed')
        })

        const result = await startStudySession('user-1',
          'chapter-1'
        )

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.type).toBe('deck_creation_failed')
          expect((result.error as any).message).toContain('Database connection failed')
        }
      })

      it('returns chapter_not_found when chapter does not exist', async () => {
        mockValidateChapterAndGetCounts.mockImplementation(() => Promise.resolve({
          success: false,
          error: { type: 'chapter_not_found' }
        }))

        const result = await startStudySession('user-1',
          'nonexistent-chapter'
        )

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.type).toBe('chapter_not_found')
        }
      })

      it('returns no_vocabulary when chapter has no vocabulary', async () => {
        mockValidateChapterAndGetCounts.mockImplementation(() => Promise.resolve({
          success: false,
          error: { type: 'no_vocabulary' }
        }))

        const result = await startStudySession('user-1',
          'empty-chapter'
        )

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.type).toBe('no_vocabulary')
        }
      })

      it('returns validation_failed on query error', async () => {
        mockValidateChapterAndGetCounts.mockImplementation(() => Promise.resolve({
          success: false,
          error: { type: 'query_error', message: 'Database timeout' }
        }))

        const result = await startStudySession('user-1',
          'chapter-1'
        )

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.type).toBe('validation_failed')
          expect((result.error as any).message).toBe('Database timeout')
        }
      })

      it('returns initialization_failed when card init fails', async () => {
        mockValidateChapterAndGetCounts.mockImplementation(() => Promise.resolve({
          success: true,
          data: { existingCardsCount: 0, totalCardsCount: 10 }
        }))
        mockInitializeChapterCards.mockImplementation(() => {
          throw new Error('Failed to insert cards')
        })

        const result = await startStudySession('user-1',
          'chapter-1'
        )

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.type).toBe('initialization_failed')
        }
      })

      it('returns card_retrieval_failed when getStudyCards fails', async () => {
        mockGetStudyCards.mockImplementation(() => {
          throw new Error('RPC function failed')
        })

        const result = await startStudySession('user-1',
          'chapter-1'
        )

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.type).toBe('card_retrieval_failed')
        }
      })

      it('returns session_creation_failed when session is null after creation', async () => {
        mockGetSession.mockImplementation(() => Promise.resolve(null))

        const result = await startStudySession('user-1',
          'chapter-1'
        )

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.type).toBe('session_creation_failed')
        }
      })
    })

    describe('success cases', () => {
      it('skips initialization when existingCardsCount >= totalCardsCount', async () => {
        mockValidateChapterAndGetCounts.mockImplementation(() => Promise.resolve({
          success: true,
          data: { existingCardsCount: 10, totalCardsCount: 10 }
        }))

        const result = await startStudySession('user-1',
          'chapter-1'
        )

        expect(result.success).toBe(true)
        expect(mockInitializeChapterCards).not.toHaveBeenCalled()
      })

      it('initializes cards when needed', async () => {
        mockValidateChapterAndGetCounts.mockImplementation(() => Promise.resolve({
          success: true,
          data: { existingCardsCount: 5, totalCardsCount: 10 }
        }))

        const result = await startStudySession('user-1',
          'chapter-1'
        )

        expect(result.success).toBe(true)
        expect(mockInitializeChapterCards).toHaveBeenCalled()
      })

      it('reuses existing valid session from cache', async () => {
        const existingSession = createTestSession({
          expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 min from now
        })
        mockGetSession.mockImplementation(() => Promise.resolve(existingSession))

        const result = await startStudySession('user-1',
          'chapter-1'
        )

        expect(result.success).toBe(true)
        expect(mockCreateSession).not.toHaveBeenCalled()
      })

      it('creates new session when expired', async () => {
        let callCount = 0
        mockGetSession.mockImplementation(() => {
          callCount++
          if (callCount === 1) {
            // First call: expired session
            return Promise.resolve(createTestSession({
              expiresAt: new Date(Date.now() - 1000) // 1 second ago
            }))
          }
          // After creation: return valid session
          return Promise.resolve(createTestSession())
        })

        const result = await startStudySession('user-1',
          'chapter-1'
        )

        expect(result.success).toBe(true)
        expect(mockCreateSession).toHaveBeenCalled()
      })

      it('returns SessionStartResponse with correct fields', async () => {
        const cards = createStudyCards(3)
        cards[0].srsCard.state = State.New
        cards[1].srsCard.state = State.New
        cards[2].srsCard.state = State.Learning
        mockGetStudyCards.mockImplementation(() => Promise.resolve(cards))

        let sessionCreated = false
        mockGetSession.mockImplementation(() => {
          if (!sessionCreated) return Promise.resolve(null)
          return Promise.resolve(createTestSession({
            cards: new Map(cards.map(c => [c.vocabulary.id, c.srsCard])),
            vocabulary: new Map(cards.map(c => [c.vocabulary.id, c.vocabulary])),
            srsCardIds: new Map(cards.map(c => [c.vocabulary.id, c.srsCardId])),
            chapterExamples: new Map(cards.map(c => [c.vocabulary.id, c.chapterExample]))
          }))
        })
        mockCreateSession.mockImplementation(() => {
          sessionCreated = true
          return Promise.resolve()
        })

        const result = await startStudySession('user-1',
          'chapter-1'
        )

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.sessionId).toBeDefined()
          expect(result.data.deckId).toBe('deck-1')
          expect(result.data.cards).toHaveLength(3)
          expect(result.data.numNewCards).toBe(2)
          expect(result.data.numCards).toBe(3)
          expect(result.data.startTime).toBeInstanceOf(Date)
        }
      })
    })
  })

  describe('endStudySession', () => {
    beforeEach(() => {
      // Default: valid session with some reviews
      const session = createTestSession({
        userId: 'user-1',
        deckId: 'deck-1',
        chapterId: 'chapter-1'
      })
      session.logs.set('vocab-1', [createTestReviewLog()])
      mockGetSession.mockImplementation(() => Promise.resolve(session))
    })

    describe('error cases', () => {
      it('returns session_not_found if session not in cache', async () => {
        mockGetSession.mockImplementation(() => Promise.resolve(null))

        const result = await endStudySession('user-1',
          'session-1'
        )

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.type).toBe('session_not_found')
        }
      })

      it('returns unauthorized if session.userId !== userId', async () => {
        mockGetSession.mockImplementation(() => Promise.resolve(
          createTestSession({ userId: 'other-user' })
        ))

        const result = await endStudySession('user-1',
          'session-1'
        )

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.type).toBe('unauthorized')
        }
      })

      it('returns persistence_failed on persistSessionReviews error', async () => {
        mockPersistSessionReviews.mockImplementation(() => {
          throw new Error('Transaction failed')
        })

        const result = await endStudySession('user-1',
          'session-1'
        )

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.type).toBe('persistence_failed')
          expect((result.error as any).message).toContain('Transaction failed')
        }
      })
    })

    describe('success cases', () => {
      it('collects session data for persistence', async () => {
        const result = await endStudySession('user-1',
          'session-1'
        )

        expect(result.success).toBe(true)
        expect(mockPersistSessionReviews).toHaveBeenCalled()
      })

      it('persists session reviews', async () => {
        const result = await endStudySession('user-1',
          'session-1'
        )

        expect(result.success).toBe(true)
        expect(mockPersistSessionReviews).toHaveBeenCalledWith(
          'user-1',
          'deck-1',
          expect.any(Map), // cardsToUpdate
          expect.any(Array) // logsToPersist
        )
      })

      it('updates chapter and series progress', async () => {
        const result = await endStudySession('user-1',
          'session-1'
        )

        expect(result.success).toBe(true)
        expect(mockCreateStudySession).toHaveBeenCalled()
        expect(mockUpdateChapterProgress).toHaveBeenCalled()
        expect(mockUpdateSeriesProgress).toHaveBeenCalled()
      })

      it('deletes session from cache', async () => {
        const result = await endStudySession('user-1',
          'session-1'
        )

        expect(result.success).toBe(true)
        expect(mockDeleteSession).toHaveBeenCalledWith('session-1')
      })

      it('continues on progress update failure (non-blocking)', async () => {
        mockUpdateChapterProgress.mockImplementation(() => {
          throw new Error('Progress update failed')
        })

        const result = await endStudySession('user-1',
          'session-1'
        )

        // Should still succeed
        expect(result.success).toBe(true)
      })

      it('continues on session deletion failure', async () => {
        mockDeleteSession.mockImplementation(() => {
          throw new Error('Redis error')
        })

        const result = await endStudySession('user-1',
          'session-1'
        )

        // Should still succeed
        expect(result.success).toBe(true)
      })

      it('returns SessionEndStats with correct fields', async () => {
        const session = createTestSession({
          userId: 'user-1',
          createdAt: new Date(Date.now() - 5 * 60 * 1000) // 5 min ago
        })
        session.logs.set('vocab-1', [
          createTestReviewLog(3), // Good
          createTestReviewLog(4)  // Easy
        ])
        session.logs.set('vocab-2', [
          createTestReviewLog(1)  // Again
        ])
        mockGetSession.mockImplementation(() => Promise.resolve(session))

        const result = await endStudySession('user-1',
          'session-1'
        )

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.cardsStudied).toBe(3)
          expect(result.data.accuracy).toBeCloseTo(66.67, 0)
          expect(result.data.timeSpentSeconds).toBeGreaterThan(0)
        }
      })
    })
  })

  describe('mapValidationError', () => {
    it('maps chapter_not_found correctly', async () => {
      mockValidateChapterAndGetCounts.mockImplementation(() => Promise.resolve({
        success: false,
        error: { type: 'chapter_not_found' }
      }))

      const result = await startStudySession(
        mockSupabase.client as any,
        'user-1',
        'chapter-1'
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.type).toBe('chapter_not_found')
      }
    })

    it('maps no_vocabulary correctly', async () => {
      mockValidateChapterAndGetCounts.mockImplementation(() => Promise.resolve({
        success: false,
        error: { type: 'no_vocabulary' }
      }))

      const result = await startStudySession(
        mockSupabase.client as any,
        'user-1',
        'chapter-1'
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.type).toBe('no_vocabulary')
      }
    })

    it('maps query_error to validation_failed with message', async () => {
      mockValidateChapterAndGetCounts.mockImplementation(() => Promise.resolve({
        success: false,
        error: { type: 'query_error', message: 'Connection timeout' }
      }))

      const result = await startStudySession(
        mockSupabase.client as any,
        'user-1',
        'chapter-1'
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.type).toBe('validation_failed')
        expect((result.error as any).message).toBe('Connection timeout')
      }
    })
  })
})
