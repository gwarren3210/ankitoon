/**
 * Batch Card Updates Tests
 *
 * Tests FSRS card state persistence with RPC fallback.
 * Verifies correct state/rating enum conversions and batch operations.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { State, Rating } from 'ts-fsrs'
import { createMockSupabase } from '@/lib/test-utils'
import {
  createTestCard,
  createLearningCard,
  createReviewCard,
  createTestReviewLog
} from '@/lib/test-utils'

// Track current mock supabase for createClient mock
let mockSupabase: ReturnType<typeof createMockSupabase>

// Mock logger
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
const {
  batchUpdateSrsCards,
  batchLogReviews,
  persistSessionReviews
} = await import('@/lib/study/batchCardUpdates')

describe('batchCardUpdates', () => {
  beforeEach(() => {
    mockSupabase = createMockSupabase()
  })

  describe('batchUpdateSrsCards', () => {
    it('does nothing for empty cards map', async () => {
      const cards = new Map()

      await batchUpdateSrsCards('user-1', 'deck-1', cards)

      expect(mockSupabase.mocks.from).not.toHaveBeenCalled()
    })

    it('upserts cards with correct conflict handling', async () => {
      const cards = new Map([
        ['vocab-1', createTestCard({ state: State.New })]
      ])
      mockSupabase.setQueryResponse('user_deck_srs_cards', null)

      await batchUpdateSrsCards('user-1', 'deck-1', cards)

      expect(mockSupabase.mocks.from).toHaveBeenCalledWith('user_deck_srs_cards')
      expect(mockSupabase.mocks.upsert).toHaveBeenCalled()
    })

    it('converts FSRS state to DB state correctly', async () => {
      const cards = new Map([
        ['vocab-1', createTestCard({ state: State.New })],
        ['vocab-2', createLearningCard({ state: State.Learning })],
        ['vocab-3', createReviewCard({ state: State.Review })]
      ])
      mockSupabase.setQueryResponse('user_deck_srs_cards', null)

      await batchUpdateSrsCards('user-1', 'deck-1', cards)

      const upsertCall = mockSupabase.mocks.upsert.mock.calls[0]
      const insertData = upsertCall[0] as Array<{ state: string }>

      expect(insertData[0].state).toBe('New')
      expect(insertData[1].state).toBe('Learning')
      expect(insertData[2].state).toBe('Review')
    })

    it('converts Date fields to ISO strings', async () => {
      const dueDate = new Date('2024-01-15T10:00:00.000Z')
      const lastReview = new Date('2024-01-14T10:00:00.000Z')
      const cards = new Map([
        ['vocab-1', createLearningCard({ due: dueDate, last_review: lastReview })]
      ])
      mockSupabase.setQueryResponse('user_deck_srs_cards', null)

      await batchUpdateSrsCards('user-1', 'deck-1', cards)

      const upsertCall = mockSupabase.mocks.upsert.mock.calls[0]
      const insertData = upsertCall[0] as Array<{ due: string; last_reviewed_date: string | null }>

      expect(insertData[0].due).toBe('2024-01-15T10:00:00.000Z')
      expect(insertData[0].last_reviewed_date).toBe('2024-01-14T10:00:00.000Z')
    })

    it('handles null last_review', async () => {
      const cards = new Map([
        ['vocab-1', createTestCard({ last_review: undefined })]
      ])
      mockSupabase.setQueryResponse('user_deck_srs_cards', null)

      await batchUpdateSrsCards('user-1', 'deck-1', cards)

      const upsertCall = mockSupabase.mocks.upsert.mock.calls[0]
      const insertData = upsertCall[0] as Array<{ last_reviewed_date: string | null }>

      expect(insertData[0].last_reviewed_date).toBeNull()
    })

    it('throws on Supabase error', async () => {
      const cards = new Map([
        ['vocab-1', createTestCard()]
      ])
      mockSupabase.setQueryResponse('user_deck_srs_cards', null, {
        message: 'Database error',
        code: 'PGRST500'
      })

      await expect(
        batchUpdateSrsCards('user-1', 'deck-1', cards)
      ).rejects.toMatchObject({ message: 'Database error' })
    })

    it('includes all card properties', async () => {
      const cards = new Map([
        ['vocab-1', createLearningCard({
          stability: 5.5,
          difficulty: 4.2,
          reps: 3,
          lapses: 1
        })]
      ])
      mockSupabase.setQueryResponse('user_deck_srs_cards', null)

      await batchUpdateSrsCards('user-1', 'deck-1', cards)

      const upsertCall = mockSupabase.mocks.upsert.mock.calls[0]
      const insertData = upsertCall[0] as Array<{
        stability: number
        difficulty: number
        total_reviews: number
        streak_incorrect: number
      }>

      expect(insertData[0].stability).toBe(5.5)
      expect(insertData[0].difficulty).toBe(4.2)
      expect(insertData[0].total_reviews).toBe(3)
      expect(insertData[0].streak_incorrect).toBe(1)
    })
  })

  describe('batchLogReviews', () => {
    it('does nothing for empty logs array', async () => {
      await batchLogReviews('user-1', [])

      expect(mockSupabase.mocks.from).not.toHaveBeenCalled()
    })

    it('inserts all log entries', async () => {
      const logs = [
        { vocabularyId: 'vocab-1', log: createTestReviewLog(Rating.Good), srsCardId: 'srs-1' },
        { vocabularyId: 'vocab-2', log: createTestReviewLog(Rating.Easy), srsCardId: 'srs-2' }
      ]
      mockSupabase.setQueryResponse('srs_progress_logs', null)

      await batchLogReviews('user-1', logs)

      expect(mockSupabase.mocks.from).toHaveBeenCalledWith('srs_progress_logs')
      expect(mockSupabase.mocks.insert).toHaveBeenCalled()
      const insertCall = mockSupabase.mocks.insert.mock.calls[0]
      expect(insertCall[0]).toHaveLength(2)
    })

    it('converts rating enum correctly (Again/Hard/Good/Easy)', async () => {
      const logs = [
        { vocabularyId: 'vocab-1', log: createTestReviewLog(Rating.Again), srsCardId: 'srs-1' },
        { vocabularyId: 'vocab-2', log: createTestReviewLog(Rating.Hard), srsCardId: 'srs-2' },
        { vocabularyId: 'vocab-3', log: createTestReviewLog(Rating.Good), srsCardId: 'srs-3' },
        { vocabularyId: 'vocab-4', log: createTestReviewLog(Rating.Easy), srsCardId: 'srs-4' }
      ]
      mockSupabase.setQueryResponse('srs_progress_logs', null)

      await batchLogReviews('user-1', logs)

      const insertCall = mockSupabase.mocks.insert.mock.calls[0]
      const insertData = insertCall[0] as Array<{ rating: string }>

      expect(insertData[0].rating).toBe('Again')
      expect(insertData[1].rating).toBe('Hard')
      expect(insertData[2].rating).toBe('Good')
      expect(insertData[3].rating).toBe('Easy')
    })

    it('converts state enum correctly', async () => {
      const logs = [
        {
          vocabularyId: 'vocab-1',
          log: createTestReviewLog(Rating.Good, { state: State.Learning }),
          srsCardId: 'srs-1'
        },
        {
          vocabularyId: 'vocab-2',
          log: createTestReviewLog(Rating.Good, { state: State.Review }),
          srsCardId: 'srs-2'
        }
      ]
      mockSupabase.setQueryResponse('srs_progress_logs', null)

      await batchLogReviews('user-1', logs)

      const insertCall = mockSupabase.mocks.insert.mock.calls[0]
      const insertData = insertCall[0] as Array<{ state: string }>

      expect(insertData[0].state).toBe('Learning')
      expect(insertData[1].state).toBe('Review')
    })

    it('converts Date fields to ISO strings', async () => {
      const dueDate = new Date('2024-01-15T10:00:00.000Z')
      const reviewDate = new Date('2024-01-15T10:30:00.000Z')
      const logs = [
        {
          vocabularyId: 'vocab-1',
          log: createTestReviewLog(Rating.Good, { due: dueDate, review: reviewDate }),
          srsCardId: 'srs-1'
        }
      ]
      mockSupabase.setQueryResponse('srs_progress_logs', null)

      await batchLogReviews('user-1', logs)

      const insertCall = mockSupabase.mocks.insert.mock.calls[0]
      const insertData = insertCall[0] as Array<{ due: string; review: string }>

      expect(insertData[0].due).toBe('2024-01-15T10:00:00.000Z')
      expect(insertData[0].review).toBe('2024-01-15T10:30:00.000Z')
    })

    it('throws on Supabase error', async () => {
      const logs = [
        { vocabularyId: 'vocab-1', log: createTestReviewLog(Rating.Good), srsCardId: 'srs-1' }
      ]
      mockSupabase.setQueryResponse('srs_progress_logs', null, {
        message: 'Insert failed',
        code: 'PGRST500'
      })

      await expect(
        batchLogReviews('user-1', logs)
      ).rejects.toMatchObject({ message: 'Insert failed' })
    })

    it('includes srsCardId in insert data', async () => {
      const logs = [
        { vocabularyId: 'vocab-1', log: createTestReviewLog(Rating.Good), srsCardId: 'my-srs-card-id' }
      ]
      mockSupabase.setQueryResponse('srs_progress_logs', null)

      await batchLogReviews('user-1', logs)

      const insertCall = mockSupabase.mocks.insert.mock.calls[0]
      const insertData = insertCall[0] as Array<{ srs_card_id: string }>

      expect(insertData[0].srs_card_id).toBe('my-srs-card-id')
    })
  })

  describe('persistSessionReviews', () => {
    it('does nothing for empty cards and logs', async () => {
      const cards = new Map()
      const logs: any[] = []

      await persistSessionReviews('user-1', 'deck-1', cards, logs)

      expect(mockSupabase.mocks.rpc).not.toHaveBeenCalled()
    })

    it('calls RPC persist_session_reviews first', async () => {
      const cards = new Map([
        ['vocab-1', createTestCard()]
      ])
      const logs = [
        { vocabularyId: 'vocab-1', log: createTestReviewLog(Rating.Good), srsCardId: 'srs-1' }
      ]
      mockSupabase.setRpcResponse('persist_session_reviews', null)

      await persistSessionReviews('user-1', 'deck-1', cards, logs)

      expect(mockSupabase.mocks.rpc).toHaveBeenCalledWith(
        'persist_session_reviews',
        expect.objectContaining({
          p_user_id: 'user-1',
          p_deck_id: 'deck-1'
        })
      )
    })

    it('falls back to batch operations on RPC failure', async () => {
      const cards = new Map([
        ['vocab-1', createTestCard()]
      ])
      const logs = [
        { vocabularyId: 'vocab-1', log: createTestReviewLog(Rating.Good), srsCardId: 'srs-1' }
      ]
      mockSupabase.setRpcResponse('persist_session_reviews', null, {
        message: 'RPC failed',
        code: 'PGRST500'
      })
      mockSupabase.setQueryResponse('user_deck_srs_cards', null)
      mockSupabase.setQueryResponse('srs_progress_logs', null)

      await persistSessionReviews('user-1', 'deck-1', cards, logs)

      // Should fall back to batch operations
      expect(mockSupabase.mocks.from).toHaveBeenCalledWith('user_deck_srs_cards')
      expect(mockSupabase.mocks.from).toHaveBeenCalledWith('srs_progress_logs')
    })

    it('formats card updates correctly for RPC', async () => {
      const cards = new Map([
        ['vocab-1', createLearningCard({
          state: State.Learning,
          stability: 5.0,
          difficulty: 4.2,
          reps: 3,
          lapses: 1,
          due: new Date('2024-01-15T10:00:00.000Z')
        })]
      ])
      mockSupabase.setRpcResponse('persist_session_reviews', null)

      await persistSessionReviews('user-1', 'deck-1', cards, [])

      const rpcCall = mockSupabase.mocks.rpc.mock.calls[0]
      const params = rpcCall[1] as {
        p_card_updates: Array<{
          vocabulary_id: string
          state: string
          stability: number
          difficulty: number
          total_reviews: number
          streak_incorrect: number
          due: string
        }>
      }

      expect(params.p_card_updates[0].vocabulary_id).toBe('vocab-1')
      expect(params.p_card_updates[0].state).toBe('Learning')
      expect(params.p_card_updates[0].stability).toBe(5.0)
      expect(params.p_card_updates[0].difficulty).toBe(4.2)
      expect(params.p_card_updates[0].total_reviews).toBe(3)
      expect(params.p_card_updates[0].streak_incorrect).toBe(1)
      expect(params.p_card_updates[0].due).toBe('2024-01-15T10:00:00.000Z')
    })

    it('formats review logs correctly for RPC (excludes user_id)', async () => {
      const logs = [
        {
          vocabularyId: 'vocab-1',
          log: createTestReviewLog(Rating.Good, {
            state: State.Learning,
            stability: 1.5,
            difficulty: 5.0
          }),
          srsCardId: 'srs-1'
        }
      ]
      mockSupabase.setRpcResponse('persist_session_reviews', null)

      await persistSessionReviews('user-1', 'deck-1', new Map(), logs)

      const rpcCall = mockSupabase.mocks.rpc.mock.calls[0]
      const params = rpcCall[1] as {
        p_review_logs: Array<{
          vocabulary_id: string
          srs_card_id: string
          rating: string
          state: string
          user_id?: string
        }>
      }

      expect(params.p_review_logs[0].vocabulary_id).toBe('vocab-1')
      expect(params.p_review_logs[0].srs_card_id).toBe('srs-1')
      expect(params.p_review_logs[0].rating).toBe('Good')
      expect(params.p_review_logs[0].state).toBe('Learning')
      // user_id should be excluded from RPC params
      expect(params.p_review_logs[0].user_id).toBeUndefined()
    })

    it('handles cards only (no logs)', async () => {
      const cards = new Map([
        ['vocab-1', createTestCard()]
      ])
      mockSupabase.setRpcResponse('persist_session_reviews', null)

      await persistSessionReviews('user-1', 'deck-1', cards, [])

      expect(mockSupabase.mocks.rpc).toHaveBeenCalled()
      const rpcCall = mockSupabase.mocks.rpc.mock.calls[0]
      const params = rpcCall[1] as { p_card_updates: unknown[]; p_review_logs: unknown[] }

      expect(params.p_card_updates).toHaveLength(1)
      expect(params.p_review_logs).toHaveLength(0)
    })

    it('handles logs only (no cards)', async () => {
      const logs = [
        { vocabularyId: 'vocab-1', log: createTestReviewLog(Rating.Good), srsCardId: 'srs-1' }
      ]
      mockSupabase.setRpcResponse('persist_session_reviews', null)

      await persistSessionReviews('user-1', 'deck-1', new Map(), logs)

      expect(mockSupabase.mocks.rpc).toHaveBeenCalled()
      const rpcCall = mockSupabase.mocks.rpc.mock.calls[0]
      const params = rpcCall[1] as { p_card_updates: unknown[]; p_review_logs: unknown[] }

      expect(params.p_card_updates).toHaveLength(0)
      expect(params.p_review_logs).toHaveLength(1)
    })
  })

  describe('Rating enum conversion', () => {
    it('converts Rating.Again to "Again"', async () => {
      const logs = [
        { vocabularyId: 'vocab-1', log: createTestReviewLog(Rating.Again), srsCardId: 'srs-1' }
      ]
      mockSupabase.setQueryResponse('srs_progress_logs', null)

      await batchLogReviews('user-1', logs)

      const insertCall = mockSupabase.mocks.insert.mock.calls[0]
      expect((insertCall[0] as Array<{ rating: string }>)[0].rating).toBe('Again')
    })

    it('converts Rating.Hard to "Hard"', async () => {
      const logs = [
        { vocabularyId: 'vocab-1', log: createTestReviewLog(Rating.Hard), srsCardId: 'srs-1' }
      ]
      mockSupabase.setQueryResponse('srs_progress_logs', null)

      await batchLogReviews('user-1', logs)

      const insertCall = mockSupabase.mocks.insert.mock.calls[0]
      expect((insertCall[0] as Array<{ rating: string }>)[0].rating).toBe('Hard')
    })

    it('converts Rating.Good to "Good"', async () => {
      const logs = [
        { vocabularyId: 'vocab-1', log: createTestReviewLog(Rating.Good), srsCardId: 'srs-1' }
      ]
      mockSupabase.setQueryResponse('srs_progress_logs', null)

      await batchLogReviews('user-1', logs)

      const insertCall = mockSupabase.mocks.insert.mock.calls[0]
      expect((insertCall[0] as Array<{ rating: string }>)[0].rating).toBe('Good')
    })

    it('converts Rating.Easy to "Easy"', async () => {
      const logs = [
        { vocabularyId: 'vocab-1', log: createTestReviewLog(Rating.Easy), srsCardId: 'srs-1' }
      ]
      mockSupabase.setQueryResponse('srs_progress_logs', null)

      await batchLogReviews('user-1', logs)

      const insertCall = mockSupabase.mocks.insert.mock.calls[0]
      expect((insertCall[0] as Array<{ rating: string }>)[0].rating).toBe('Easy')
    })
  })
})
