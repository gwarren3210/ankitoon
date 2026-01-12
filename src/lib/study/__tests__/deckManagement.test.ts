/**
 * Deck Management Tests
 *
 * Tests deck creation with race condition handling.
 * Verifies the get-or-create pattern and unique constraint error recovery.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { createMockSupabase } from '@/lib/test-utils'

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
const { getOrCreateDeck } = await import('@/lib/study/deckManagement')

describe('deckManagement', () => {
  beforeEach(() => {
    mockSupabase = createMockSupabase()
  })

  describe('getOrCreateDeck', () => {
    it('returns existing deck if found', async () => {
      mockSupabase.setQueryResponse('user_chapter_decks', { id: 'existing-deck-id' })

      const deck = await getOrCreateDeck(
        mockSupabase.client as any,
        'user-1',
        'chapter-1'
      )

      expect(deck.id).toBe('existing-deck-id')
      // Should not try to create a deck
      expect(mockSupabase.mocks.insert).not.toHaveBeenCalled()
    })

    it('creates new deck if not found', async () => {
      // First query returns null (deck not found)
      mockSupabase.setQueryResponse('user_chapter_decks', null, {
        message: 'No rows found',
        code: 'PGRST116'
      })
      // Chapter query for deck name
      mockSupabase.setQueryResponse('chapters', { chapter_number: 5 })

      // Need to set up the insert mock to return success
      const insertResult = { id: 'new-deck-id' }
      let callCount = 0
      mockSupabase.mocks.single.mockImplementation(() => {
        callCount++
        // First call is the getDeck query (returns error)
        if (callCount === 1) {
          return Promise.resolve({
            data: null,
            error: { message: 'No rows found', code: 'PGRST116' }
          })
        }
        // Second call is getting chapter number
        if (callCount === 2) {
          return Promise.resolve({ data: { chapter_number: 5 }, error: null })
        }
        // Third call is the insert
        return Promise.resolve({ data: insertResult, error: null })
      })

      const deck = await getOrCreateDeck(
        mockSupabase.client as any,
        'user-1',
        'chapter-1'
      )

      expect(deck.id).toBe('new-deck-id')
    })

    it('handles race condition (DUPLICATE_DECK:23505)', async () => {
      let queryCount = 0

      mockSupabase.mocks.single.mockImplementation(() => {
        queryCount++
        // First getDeck: not found
        if (queryCount === 1) {
          return Promise.resolve({
            data: null,
            error: { message: 'No rows found', code: 'PGRST116' }
          })
        }
        // Get chapter number for deck name
        if (queryCount === 2) {
          return Promise.resolve({ data: { chapter_number: 1 }, error: null })
        }
        // Create deck: race condition error
        if (queryCount === 3) {
          return Promise.resolve({
            data: null,
            error: { message: 'Unique constraint violation', code: '23505' }
          })
        }
        // Retry getDeck: success
        if (queryCount === 4) {
          return Promise.resolve({
            data: { id: 'deck-from-race-winner' },
            error: null
          })
        }
        return Promise.resolve({ data: null, error: null })
      })

      const deck = await getOrCreateDeck(
        mockSupabase.client as any,
        'user-1',
        'chapter-1'
      )

      expect(deck.id).toBe('deck-from-race-winner')
    })

    it('retries getDeck after race condition', async () => {
      let queryCount = 0

      mockSupabase.mocks.single.mockImplementation(() => {
        queryCount++
        if (queryCount === 1) {
          return Promise.resolve({
            data: null,
            error: { message: 'No rows found', code: 'PGRST116' }
          })
        }
        if (queryCount === 2) {
          return Promise.resolve({ data: { chapter_number: 1 }, error: null })
        }
        if (queryCount === 3) {
          return Promise.resolve({
            data: null,
            error: { message: 'Unique constraint violation', code: '23505' }
          })
        }
        // The retry should succeed
        if (queryCount === 4) {
          return Promise.resolve({
            data: { id: 'retried-deck-id' },
            error: null
          })
        }
        return Promise.resolve({ data: null, error: null })
      })

      const deck = await getOrCreateDeck(
        mockSupabase.client as any,
        'user-1',
        'chapter-1'
      )

      expect(queryCount).toBeGreaterThanOrEqual(4)
      expect(deck.id).toBe('retried-deck-id')
    })

    it('throws if retry fails to find deck', async () => {
      let queryCount = 0

      mockSupabase.mocks.single.mockImplementation(() => {
        queryCount++
        if (queryCount === 1) {
          return Promise.resolve({
            data: null,
            error: { message: 'No rows found', code: 'PGRST116' }
          })
        }
        if (queryCount === 2) {
          return Promise.resolve({ data: { chapter_number: 1 }, error: null })
        }
        if (queryCount === 3) {
          return Promise.resolve({
            data: null,
            error: { message: 'Unique constraint violation', code: '23505' }
          })
        }
        // Retry also fails to find deck
        if (queryCount === 4) {
          return Promise.resolve({
            data: null,
            error: { message: 'No rows found', code: 'PGRST116' }
          })
        }
        return Promise.resolve({ data: null, error: null })
      })

      await expect(
        getOrCreateDeck('user-1', 'chapter-1')
      ).rejects.toThrow('Deck creation failed due to race condition and deck not found on retry')
    })

    it('throws on unexpected getDeck errors', async () => {
      mockSupabase.mocks.single.mockImplementation(() => {
        return Promise.resolve({
          data: null,
          error: { message: 'Database connection failed', code: 'PGRST500' }
        })
      })

      await expect(
        getOrCreateDeck('user-1', 'chapter-1')
      ).rejects.toThrow('Failed to fetch study deck: Database connection failed')
    })

    it('throws on chapter fetch error', async () => {
      let queryCount = 0

      mockSupabase.mocks.single.mockImplementation(() => {
        queryCount++
        // First: getDeck returns not found
        if (queryCount === 1) {
          return Promise.resolve({
            data: null,
            error: { message: 'No rows found', code: 'PGRST116' }
          })
        }
        // Second: chapter query fails
        if (queryCount === 2) {
          return Promise.resolve({
            data: null,
            error: { message: 'Chapter not found', code: 'PGRST116' }
          })
        }
        return Promise.resolve({ data: null, error: null })
      })

      await expect(
        getOrCreateDeck('user-1', 'chapter-1')
      ).rejects.toThrow('Failed to fetch chapter data')
    })

    it('creates deck with correct name format', async () => {
      let queryCount = 0
      let insertedData: any = null

      mockSupabase.mocks.single.mockImplementation(() => {
        queryCount++
        if (queryCount === 1) {
          return Promise.resolve({
            data: null,
            error: { message: 'No rows found', code: 'PGRST116' }
          })
        }
        if (queryCount === 2) {
          return Promise.resolve({ data: { chapter_number: 42 }, error: null })
        }
        return Promise.resolve({ data: { id: 'new-deck' }, error: null })
      })

      mockSupabase.mocks.insert.mockImplementation((data: any) => {
        insertedData = data
        return mockSupabase.mocks
      })

      await getOrCreateDeck('user-1', 'chapter-1')

      expect(insertedData.name).toBe('Chapter 42')
    })

    it('handles unknown chapter number', async () => {
      let queryCount = 0
      let insertedData: any = null

      mockSupabase.mocks.single.mockImplementation(() => {
        queryCount++
        if (queryCount === 1) {
          return Promise.resolve({
            data: null,
            error: { message: 'No rows found', code: 'PGRST116' }
          })
        }
        if (queryCount === 2) {
          // Chapter found but no chapter_number
          return Promise.resolve({ data: { chapter_number: null }, error: null })
        }
        return Promise.resolve({ data: { id: 'new-deck' }, error: null })
      })

      mockSupabase.mocks.insert.mockImplementation((data: any) => {
        insertedData = data
        return mockSupabase.mocks
      })

      await getOrCreateDeck('user-1', 'chapter-1')

      expect(insertedData.name).toBe('Chapter Unknown')
    })

    it('throws on non-duplicate create error', async () => {
      let queryCount = 0

      mockSupabase.mocks.single.mockImplementation(() => {
        queryCount++
        if (queryCount === 1) {
          return Promise.resolve({
            data: null,
            error: { message: 'No rows found', code: 'PGRST116' }
          })
        }
        if (queryCount === 2) {
          return Promise.resolve({ data: { chapter_number: 1 }, error: null })
        }
        // Create fails with unexpected error
        return Promise.resolve({
          data: null,
          error: { message: 'Permission denied', code: '42501' }
        })
      })

      await expect(
        getOrCreateDeck('user-1', 'chapter-1')
      ).rejects.toThrow('Failed to create study deck: Permission denied')
    })

    it('includes user_id and chapter_id in insert', async () => {
      let queryCount = 0
      let insertedData: any = null

      mockSupabase.mocks.single.mockImplementation(() => {
        queryCount++
        if (queryCount === 1) {
          return Promise.resolve({
            data: null,
            error: { message: 'No rows found', code: 'PGRST116' }
          })
        }
        if (queryCount === 2) {
          return Promise.resolve({ data: { chapter_number: 1 }, error: null })
        }
        return Promise.resolve({ data: { id: 'new-deck' }, error: null })
      })

      mockSupabase.mocks.insert.mockImplementation((data: any) => {
        insertedData = data
        return mockSupabase.mocks
      })

      await getOrCreateDeck('my-user', 'my-chapter')

      expect(insertedData.user_id).toBe('my-user')
      expect(insertedData.chapter_id).toBe('my-chapter')
    })
  })
})
