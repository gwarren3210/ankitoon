# Testing Guide

This guide covers how to run tests, interpret results, and work with the test coverage system in AnkiToon.

## Table of Contents

- [Quick Start](#quick-start)
- [Running Tests](#running-tests)
- [Test Coverage](#test-coverage)
- [Understanding Test Isolation](#understanding-test-isolation)
- [Adding New Tests](#adding-new-tests)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
# Run all tests (recommended)
bun run test

# Run specific test suites
bun run test:study      # Study session logic
bun run test:pipeline   # Image processing (calls external APIs)
bun run test:pure       # Pure function tests only
bun run test:mocked     # All tests with mocked dependencies
```

**Expected output:**
```
════════════════════════════════════════════════════════════
Test Summary
════════════════════════════════════════════════════════════

Batches:
  ✓ Pure Functions                   67 tests      ~50ms
  ✓ Session Data Transform           30 tests      ~30ms
  ✓ Session Cache (Redis)            35 tests      ~35ms
  ✓ Batch Card Updates               25 tests      ~25ms
  ✓ Deck Management                  11 tests      ~20ms
  ✓ Session Service                  25 tests      ~40ms
  ✓ Redis Client                     16 tests      ~25ms
  ✓ File Validator                   49 tests      ~60ms
  ✓ CSRF & Proxy                     23 tests      ~30ms

Overall:
  Total tests:  281
  Passed:       281
  Duration:     ~320ms

Result:
  ✓ All tests passed!
```

---

## Running Tests

### All Tests (Isolated for Correctness)

```bash
bun run test
```

This runs tests in **isolated batches** to prevent Bun's `mock.module()` cache pollution. Tests are grouped into:

1. **Pure tests** (67 tests) - No mocks, run together safely
   - `sessionSerialization.test.ts`
   - `utils.test.ts`

2. **Mocked tests** (214 tests) - Each file runs in its own process
   - `sessionDataTransform.test.ts`
   - `sessionCache.test.ts`
   - `batchCardUpdates.test.ts`
   - `deckManagement.test.ts`
   - `sessionService.test.ts`
   - `client.test.ts` (Redis)
   - `fileValidator.test.ts`
   - `proxy.test.ts`

### Individual Test Suites

```bash
# Study session logic (all study tests)
bun run test:study

# Pure function tests only
bun run test:pure

# All mocked tests
bun run test:mocked

# Pipeline integration tests (OCR + Gemini API)
bun run test:pipeline
```

### Single Test File

```bash
# Run a specific test file
bun test src/lib/study/__tests__/sessionCache.test.ts

# Run with verbose output
bun test --verbose src/lib/study/__tests__/sessionCache.test.ts

# Run only tests matching a pattern
bun test --test-name-pattern "TTL" src/lib/study/__tests__/sessionCache.test.ts
```

---

## Test Coverage

### Running Coverage

Generate comprehensive coverage reports across all test batches:

```bash
bun run test:coverage
```

This custom script:
- Runs all 9 test batches in isolation (prevents mock pollution)
- Captures coverage output from Bun's native coverage
- Aggregates coverage data across all batches
- Generates text summary and HTML report
- Takes ~500ms total

**View HTML Report:**
```bash
bun run test:coverage:open
# Or manually: open coverage/index.html
```

### Coverage Reports

The script generates two formats:

1. **Text Summary** - Displayed in console with color-coded percentages
   - Green: ≥80% coverage
   - Yellow: 50-79% coverage
   - Red: <50% coverage

2. **HTML Report** (`coverage/index.html`)
   - Interactive file-by-file breakdown
   - Grouped by directory
   - Shows uncovered line numbers
   - Includes overall statistics

### Current Coverage

**Overall:** ~82% functions, ~85% lines (281 tests)

**By Module:**
- `src/lib/study/` - 97-100% (Study session logic)
- `src/lib/redis/` - 71-94% (Redis client)
- `src/lib/uploads/` - 100% (File validation)
- `src/proxy.ts` - 99-100% (CSRF protection)

### Coverage Goals

| Module | Target | Current | Status |
|--------|--------|---------|--------|
| `src/lib/study/` | 90% | ~98% | ✅ Exceeds |
| `src/lib/redis/` | 80% | ~94% | ✅ Exceeds |
| `src/lib/uploads/` | 85% | 100% | ✅ Exceeds |
| `src/proxy.ts` | 85% | ~99% | ✅ Exceeds |
| **Overall** | **70%** | **~84%** | ✅ **Exceeds** |

**Note:** Pipeline tests (`src/lib/pipeline/`) are integration tests calling external APIs (OCR.space, Google Gemini) and are excluded from coverage metrics.

### How Coverage Works

The custom coverage script (`scripts/coverage-accurate.ts`):
1. Imports shared test batch definitions from `scripts/test-batches.ts`
2. Runs each batch with `bun test` (coverage enabled in `bunfig.toml`)
3. Captures stdout/stderr and parses Bun's coverage table output
4. Aggregates coverage by taking max coverage for each file across batches
5. Generates formatted reports with color-coded percentages

---

## Understanding Test Isolation

### Why Tests Can't All Run Together

Bun's `mock.module()` modifies the **global module cache**:

```typescript
// File A: sessionCache.test.ts
mock.module('@/lib/redis/client', () => ({
  getRedisClient: mockRedis
}))

// File B: sessionService.test.ts (runs after File A)
// ❌ Problem: Still gets File A's mock instead of real module!
```

### The Solution: Isolated Batches

Tests are run in separate processes using `&&` chaining:

```bash
bun test fileA.test.ts && bun test fileB.test.ts
```

Each `&&` starts a fresh Bun process with a clean module cache.

### Which Tests Need Isolation?

**Can run together:**
- Pure functions (no mocks)
- Tests mocking the same modules

**Must run separately:**
- Any test using `mock.module()`
- Tests mocking different modules

### Test Isolation Matrix

| Test File | Mocks | Isolation Needed |
|-----------|-------|------------------|
| sessionSerialization.test.ts | None | ❌ No |
| utils.test.ts | None | ❌ No |
| sessionDataTransform.test.ts | logger | ✅ Yes |
| sessionCache.test.ts | redis/client, logger | ✅ Yes |
| batchCardUpdates.test.ts | supabase, logger | ✅ Yes |
| deckManagement.test.ts | supabase, logger | ✅ Yes |
| sessionService.test.ts | 12 modules | ✅ Yes |
| client.test.ts | redis, logger | ✅ Yes |
| fileValidator.test.ts | file-type, sharp, logger | ✅ Yes |
| proxy.test.ts | next/server, csrf, supabase | ✅ Yes |

---

## Adding New Tests

### 1. Determine Test Type

**Pure Function Test** (no mocks needed):
```typescript
// No external dependencies, can run with other pure tests
export function calculateSum(a: number, b: number): number {
  return a + b
}
```
→ Add to `test:pure` batch

**Mocked Test** (uses `mock.module()`):
```typescript
// Depends on external modules
mock.module('@/lib/logger', () => ({ ... }))
```
→ Add to `test:mocked` batch

### 2. Create Test File

```bash
# Create test file
touch src/lib/mymodule/__tests__/myFunction.test.ts
```

**Template:**
```typescript
/**
 * [Module Name] Tests
 *
 * Tests [description]:
 * - [Key scenario 1]
 * - [Key scenario 2]
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test'

// Mock external dependencies BEFORE imports
mock.module('@/lib/logger', () => ({
  logger: {
    error: mock(() => {}),
    info: mock(() => {})
  }
}))

// Import AFTER mocks
const { myFunction } = await import('@/lib/mymodule/myFunction')

describe('myFunction', () => {
  beforeEach(() => {
    // Reset mocks between tests
  })

  describe('happy path', () => {
    it('handles basic case', async () => {
      const result = await myFunction('input')
      expect(result).toBe('expected')
    })
  })

  describe('error cases', () => {
    it('throws on invalid input', async () => {
      await expect(
        myFunction(null)
      ).rejects.toThrow('Validation failed')
    })
  })
})
```

### 3. Add to Test Scripts

Edit `package.json`:

**If pure test:**
```json
"test:pure": "bun test ... src/lib/mymodule/__tests__/myFunction.test.ts"
```

**If mocked test:**
```json
"test:mocked": "... && bun test src/lib/mymodule/__tests__/myFunction.test.ts"
```

### 4. Verify Tests Run

```bash
# Run just your new test
bun test src/lib/mymodule/__tests__/myFunction.test.ts

# Run all tests to ensure no conflicts
bun run test
```

---

## Troubleshooting

### Tests Pass Individually but Fail Together

**Symptom:**
```bash
bun test fileA.test.ts  # ✅ Pass
bun test fileB.test.ts  # ✅ Pass
bun test fileA.test.ts fileB.test.ts  # ❌ Fail
```

**Cause:** Mock pollution from `mock.module()`

**Fix:** Run in separate processes
```json
"test:mocked": "bun test fileA.test.ts && bun test fileB.test.ts"
```

---

### Module Not Found After Mocking

**Symptom:**
```
TypeError: functionName is not a function
```

**Cause:** Mock setup is incomplete or module import order is wrong

**Fix:**
1. Ensure `mock.module()` comes **before** the import
2. Check mock returns the expected shape
3. Verify module path is correct

```typescript
// ❌ Wrong order
const { myFunction } = await import('@/lib/module')
mock.module('@/lib/module', () => ({ myFunction: mock() }))

// ✅ Correct order
mock.module('@/lib/module', () => ({ myFunction: mock() }))
const { myFunction } = await import('@/lib/module')
```

---

### Mock Not Resetting Between Tests

**Symptom:**
```bash
test 1  # ✅ Pass
test 2  # ❌ Fail (uses state from test 1)
```

**Cause:** Mocks retain state across tests

**Fix:** Clear mocks in `beforeEach()`
```typescript
let mockFunction: any

beforeEach(() => {
  mockFunction = mock(() => 'default')
  mockFunction.mockClear()  // ← Important!
})
```

---

### Date/Time-Based Tests Are Flaky

**Symptom:** Tests pass sometimes, fail other times

**Cause:** Using `new Date()` or `Date.now()` in tests

**Fix:** Use fixed dates
```typescript
// ❌ Flaky (different each run)
const card = { due: new Date() }

// ✅ Stable (same every run)
const card = { due: new Date('2024-01-15T10:00:00Z') }
```

---

### Tests Timeout

**Symptom:**
```
Timeout: Test exceeded 5000ms
```

**Cause:**
- Infinite loop in code
- Async operation never resolves
- Missing mock for async function

**Fix:**
1. Check for infinite loops
2. Ensure all async operations have mock responses
3. Increase timeout if legitimate:
   ```typescript
   it('slow operation', async () => {
     // ...
   }, 10000) // 10 second timeout
   ```

---

## Test File Reference

### Study Session Tests (185 tests)

| File | Tests | Focus | Mock Dependencies |
|------|-------|-------|-------------------|
| `sessionSerialization.test.ts` | 24 | Map/Date conversions | None |
| `sessionDataTransform.test.ts` | 30 | Data formatting | logger |
| `sessionCache.test.ts` | 35 | Redis CRUD + TTL | redis/client, logger |
| `batchCardUpdates.test.ts` | 25 | DB persistence | supabase, logger |
| `deckManagement.test.ts` | 11 | Race conditions | supabase, logger |
| `sessionService.test.ts` | 25 | Orchestration | 12 modules |
| `utils.test.ts` | 43 | FSRS conversions | None |

### Infrastructure Tests (96 tests)

| File | Tests | Focus | Mock Dependencies |
|------|-------|-------|-------------------|
| `client.test.ts` | 16 | Redis connection | redis, logger |
| `fileValidator.test.ts` | 49 | Upload security | file-type, sharp, logger |
| `proxy.test.ts` | 23 | CSRF/origin validation | next/server, csrf, supabase |

---

## Best Practices

### ✅ Do

- **Always run `bun run test` before committing**
- **Add tests for new features before implementing**
- **Mock external dependencies** (databases, APIs, file system)
- **Use test factories** for creating test data
- **Clear mocks in `beforeEach()`** to prevent cross-test pollution
- **Test error paths**, not just happy paths

### ❌ Don't

- **Don't skip tests** with `.skip` unless temporarily debugging
- **Don't use real databases or APIs** in unit tests
- **Don't use `new Date()` or `Date.now()`** in test data
- **Don't test implementation details**, test behavior
- **Don't commit failing tests**
- **Don't run mocked tests together** without isolation

---

## CI/CD Integration

For continuous integration, use:

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: bun run test

# Coverage reporting to be added when tooling supports it
```

---

## Further Reading

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- Project-specific patterns: See `src/lib/test-utils/` for reusable mocks
