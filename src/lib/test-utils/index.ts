/**
 * Test Utilities - Centralized Exports
 *
 * Re-exports all test utilities for convenient importing:
 * import { createMockSupabase, createTestSession, ... } from '@/lib/test-utils'
 */

// Fixtures - Realistic test data
export {
  testVocabulary,
  testVocabulary2,
  testVocabulary3,
  createTestCard,
  createLearningCard,
  createReviewCard,
  createTestReviewLog,
  createTestSession,
  createTestSerializedSession,
  testUserIds,
  testIds
} from './fixtures'

// Mock Factories - Factory functions for test objects
export {
  type StudyCard,
  createStudyCard,
  createStudyCards,
  createSessionStartResponse,
  createSessionEndStats,
  createDeckRow,
  createChapterRow,
  createSrsCardRow,
  createReviewLogEntry,
  createValidationResult,
  createGetStudyCardsResponse,
  createPersistSessionParams
} from './mockFactories'

// Supabase Mock - Database mock with chainable API
export {
  createMockSupabase,
  type MockSupabase,
  type MockQueryResult,
  type MockSupabaseConfig
} from './supabaseMock'

// Redis Mock - In-memory Redis with TTL support
export {
  createMockRedis,
  type MockRedis,
  type MockRedisEntry,
  type MockRedisConfig
} from './redisMock'
