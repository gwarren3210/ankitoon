/**
 * Test Batch Definitions
 *
 * Shared across test-all.ts and coverage-accurate.ts to ensure
 * test isolation and coverage parity.
 *
 * Why this exists:
 * - Single source of truth for test organization
 * - Prevents drift between test runner and coverage scripts
 * - Adding new tests requires updating only one file
 * - Guarantees coverage metrics include all tests
 */

export interface TestBatch {
  name: string
  files: string[]
}

export const testBatches: TestBatch[] = [
  {
    name: 'Pure Functions',
    files: [
      'src/lib/study/__tests__/sessionSerialization.test.ts',
      'src/lib/study/__tests__/utils.test.ts'
    ]
  },
  {
    name: 'Session Data Transform',
    files: ['src/lib/study/__tests__/sessionDataTransform.test.ts']
  },
  {
    name: 'Session Cache (Redis)',
    files: ['src/lib/study/__tests__/sessionCache.test.ts']
  },
  {
    name: 'Batch Card Updates',
    files: ['src/lib/study/__tests__/batchCardUpdates.test.ts']
  },
  {
    name: 'Deck Management',
    files: ['src/lib/study/__tests__/deckManagement.test.ts']
  },
  {
    name: 'Session Service',
    files: ['src/lib/study/__tests__/sessionService.test.ts']
  },
  {
    name: 'Redis Client',
    files: ['src/lib/redis/__tests__/client.test.ts']
  },
  {
    name: 'File Validator',
    files: ['src/lib/uploads/__tests__/fileValidator.test.ts']
  },
  {
    name: 'CSRF & Proxy',
    files: ['src/__tests__/proxy.test.ts']
  }
]
