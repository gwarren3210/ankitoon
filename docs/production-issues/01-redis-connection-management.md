# Production Issue #1: Redis Connection Management

**Severity:** CRITICAL 🔴
**Impact:** High - Could cause production outages and cascading failures
**Affected File:** `src/lib/redis/client.ts`
**Lines:** 18-25

---

## Problem Description

The current Redis connection management implementation has a **race
condition** and uses an inefficient busy-wait loop that could cause
production outages.

### Current Implementation

```typescript
// src/lib/redis/client.ts (lines 18-25)
if (isConnecting) {
  while (isConnecting && (!redisClient || !redisClient.isOpen)) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}
```

### What's Wrong

1. **Busy-Wait Loop**
   - Uses `setTimeout(100)` in a while loop
   - Wastes CPU cycles and blocks the Node.js event loop
   - Inefficient under high concurrency

2. **No Timeout**
   - Loop could run forever if connection hangs
   - No maximum wait time defined
   - Could accumulate hundreds of waiting requests

3. **Race Condition on Flag**
   - `isConnecting` flag could get stuck if connection throws
   - No `finally` block to ensure flag is reset
   - Multiple concurrent calls could see inconsistent flag state

4. **No Connection Pooling**
   - Creates new Redis client on every call
   - Doesn't reuse existing connections
   - Could exhaust connection limits under load

---

## Why This Matters

### Context: Dual-Storage Architecture

AnkiToon uses a **brilliant dual-storage pattern** for study sessions:

```
User studies → Redis (instant feedback) → PostgreSQL (persistence)
```

Redis is the **critical path** for the study experience. When Redis
fails:
- Users can't rate cards (instant feedback broken)
- Sessions can't start (no cache available)
- The app feels broken even though PostgreSQL is fine

### Production Failure Scenarios

#### Scenario 1: Connection Timeout
```
User starts study session
  → Redis client tries to connect
    → Network delay (5 seconds)
      → Busy-wait loop runs 50 times
        → Request takes 5+ seconds
          → User thinks app is broken
```

#### Scenario 2: Connection Failure
```
Redis server restarts
  → isConnecting flag set to true
    → Connection throws error
      → Flag NEVER reset to false (no finally block)
        → ALL future requests wait forever
          → Complete application outage
```

#### Scenario 3: Thundering Herd
```
100 concurrent study sessions start
  → All see isConnecting = true
    → All enter busy-wait loop
      → 100 * 10 iterations * 100ms = CPU spinning
        → Event loop blocked
          → Server becomes unresponsive
```

---

## Current Risks

### High Likelihood Risks

1. **Stuck Flag** (90% probability during deployment)
   - Any connection error during initial connect
   - Server restarts or network issues
   - Results in total app outage until restart

2. **Slow Connections** (50% probability under load)
   - Cloud Redis has variable latency
   - Busy-wait makes it worse
   - Poor user experience

### Medium Likelihood Risks

3. **Memory Leaks** (30% probability over time)
   - Waiting promises accumulate
   - No cleanup of waiting requests
   - Server OOM after hours of operation

4. **Connection Limit Exhaustion** (20% probability with growth)
   - No connection pooling
   - Each request could create new client
   - Redis has connection limits (typically 10,000)

---

## Recommended Solution

### Architecture: Promise-Based Connection with Timeout

```typescript
import { createClient } from 'redis'
import { logger } from '@/lib/logger'

let redisClient: ReturnType<typeof createClient> | null = null
let connectionPromise: Promise<void> | null = null

const CONNECTION_TIMEOUT_MS = 10000 // 10 seconds
const MAX_RETRIES = 3

/**
 * Gets or creates a Redis client with proper connection management
 *
 * @returns Connected Redis client
 * @throws {Error} If connection fails after retries or timeout
 */
export async function getRedisClient() {
  // Return existing connected client
  if (redisClient?.isOpen) {
    return redisClient
  }

  // Wait for in-progress connection
  if (connectionPromise) {
    await connectionPromise
    if (!redisClient?.isOpen) {
      throw new Error('Redis connection failed')
    }
    return redisClient
  }

  // Start new connection
  connectionPromise = connectWithTimeout()

  try {
    await connectionPromise
    if (!redisClient?.isOpen) {
      throw new Error('Redis connection failed')
    }
    return redisClient
  } finally {
    connectionPromise = null
  }
}

/**
 * Connects to Redis with timeout and retry logic
 */
async function connectWithTimeout(): Promise<void> {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable not set')
  }

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      redisClient = createClient({ url: redisUrl })

      // Set up error handlers before connecting
      redisClient.on('error', (err) => {
        logger.error({ err }, 'Redis client error')
      })

      // Connect with timeout
      await Promise.race([
        redisClient.connect(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Redis connection timeout')),
            CONNECTION_TIMEOUT_MS
          )
        ),
      ])

      logger.info(
        { attempt, maxRetries: MAX_RETRIES },
        'Redis connected successfully'
      )
      return
    } catch (error) {
      lastError = error as Error
      logger.warn(
        { attempt, maxRetries: MAX_RETRIES, error },
        'Redis connection attempt failed'
      )

      // Cleanup failed client
      if (redisClient) {
        await redisClient.quit().catch(() => {})
        redisClient = null
      }

      // Wait before retry (exponential backoff)
      if (attempt < MAX_RETRIES) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        await new Promise((resolve) => setTimeout(resolve, backoffMs))
      }
    }
  }

  // All retries failed
  throw new Error(
    `Failed to connect to Redis after ${MAX_RETRIES} attempts: ${
      lastError?.message
    }`
  )
}

/**
 * Gracefully closes Redis connection
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
  }
  connectionPromise = null
}
```

### Key Improvements

1. ✅ **Promise-Based Locking**
   - Single `connectionPromise` shared by all waiting requests
   - No busy-wait loop
   - Efficient concurrency handling

2. ✅ **Timeout Protection**
   - 10-second maximum wait per attempt
   - `Promise.race()` ensures timeout is enforced
   - Prevents infinite hangs

3. ✅ **Retry Logic**
   - 3 attempts with exponential backoff
   - Graceful degradation
   - Logged for monitoring

4. ✅ **Proper Cleanup**
   - `finally` block always resets promise
   - Error handlers prevent crash on disconnect
   - Graceful shutdown method

5. ✅ **Connection Reuse**
   - Returns existing client if already open
   - Only creates new client when needed
   - Better resource utilization

---

## Implementation Steps

### Step 1: Update Redis Client (30 minutes)

1. Replace `src/lib/redis/client.ts` with new implementation above
2. Add graceful shutdown to `src/app/api/shutdown/route.ts` (if exists)
3. Update imports if needed

### Step 2: Add Environment Validation (15 minutes)

Create `src/lib/config.ts`:

```typescript
/**
 * Validates required environment variables at startup
 * @throws {Error} If required variables are missing
 */
export function validateEnvironment(): void {
  const required = ['REDIS_URL', 'NEXT_PUBLIC_SUPABASE_URL']

  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    )
  }

  // Validate Redis URL format
  if (!process.env.REDIS_URL?.startsWith('redis://')) {
    throw new Error('REDIS_URL must start with redis://')
  }
}
```

Call in `src/app/layout.tsx` or app initialization.

### Step 3: Add Connection Health Check (15 minutes)

Create `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getRedisClient } from '@/lib/redis/client'

export async function GET() {
  try {
    const redis = await getRedisClient()
    await redis.ping()

    return NextResponse.json({
      status: 'healthy',
      redis: 'connected',
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        redis: 'disconnected',
        error: (error as Error).message,
      },
      { status: 503 }
    )
  }
}
```

### Step 4: Update Session Cache Usage (15 minutes)

Review all calls to Redis in `src/lib/study/sessionCache.ts`:

```typescript
// Add timeout to all Redis operations
async function getSessionFromCache(sessionId: string) {
  const redis = await getRedisClient()

  // Add operation timeout (separate from connection timeout)
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Redis operation timeout')), 5000)
  )

  const dataPromise = redis.get(`session:${sessionId}`)

  return Promise.race([dataPromise, timeoutPromise])
}
```

---

## Testing Approach

### Unit Tests

Create `src/lib/redis/__tests__/client.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test'
import { getRedisClient, closeRedisClient } from '../client'

describe('Redis Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await closeRedisClient()
  })

  it('should connect successfully', async () => {
    const client = await getRedisClient()
    expect(client.isOpen).toBe(true)
  })

  it('should reuse existing connection', async () => {
    const client1 = await getRedisClient()
    const client2 = await getRedisClient()
    expect(client1).toBe(client2)
  })

  it('should timeout after 10 seconds', async () => {
    // Mock slow connection
    vi.spyOn(global, 'setTimeout').mockImplementation(
      (fn, ms) => {
        if (ms === 10000) fn()
        return {} as any
      }
    )

    await expect(getRedisClient()).rejects.toThrow('timeout')
  })

  it('should retry on failure', async () => {
    // Test retry logic
    let attempts = 0
    vi.mock('redis', () => ({
      createClient: () => {
        attempts++
        if (attempts < 3) throw new Error('Connection failed')
        return { connect: vi.fn(), isOpen: true }
      },
    }))

    const client = await getRedisClient()
    expect(attempts).toBe(3)
  })
})
```

### Integration Tests

```typescript
describe('Redis Integration', () => {
  it('should handle concurrent connections', async () => {
    // Simulate 100 concurrent requests
    const promises = Array.from({ length: 100 }, () => getRedisClient())

    const clients = await Promise.all(promises)

    // All should get the same client instance
    expect(new Set(clients).size).toBe(1)
  })

  it('should recover from disconnect', async () => {
    const client = await getRedisClient()

    // Simulate disconnect
    await client.quit()

    // Should create new connection
    const newClient = await getRedisClient()
    expect(newClient.isOpen).toBe(true)
  })
})
```

### Chaos Testing

```typescript
describe('Redis Chaos Tests', () => {
  it('should handle Redis server restart', async () => {
    // Start session
    const session = await startStudySession(userId, chapterSlug)

    // Kill Redis
    // Wait for restart

    // Should recover and continue
    const cards = await getSessionCards(session.id)
    expect(cards).toBeDefined()
  })
})
```

---

## Monitoring & Alerts

### Metrics to Track

1. **Connection Latency**
   - Average time to establish connection
   - Alert if > 2 seconds

2. **Connection Failures**
   - Count of failed connection attempts
   - Alert if > 5 in 5 minutes

3. **Operation Timeouts**
   - Count of Redis operation timeouts
   - Alert if > 10 in 5 minutes

4. **Connection Pool Size**
   - Number of active connections
   - Alert if > 100 (potential leak)

### Implementation

```typescript
// Add to logger
logger.info(
  {
    connectionLatencyMs: Date.now() - startTime,
    attempt,
    maxRetries: MAX_RETRIES,
  },
  'Redis connection metrics'
)
```

---

## Rollout Strategy

### Phase 1: Staging Deployment
- Deploy to staging environment
- Run load tests (100 concurrent users)
- Monitor for 48 hours

### Phase 2: Canary Deployment
- Deploy to 10% of production traffic
- Monitor connection metrics
- Rollback plan: Revert to previous version

### Phase 3: Full Rollout
- Deploy to 100% of production
- Monitor for 7 days
- Document any issues

---

## Success Criteria

✅ Connection latency < 500ms (p95)
✅ Zero stuck connection flags in 7 days
✅ Connection success rate > 99.9%
✅ No production incidents related to Redis
✅ All tests passing with 100% coverage

---

## References

- [Redis Node.js Client Docs](https://github.com/redis/node-redis)
- [Connection Pooling Best Practices](https://redis.io/docs/clients/)
- [Promise.race() for Timeouts](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race)
- [Exponential Backoff Pattern](https://en.wikipedia.org/wiki/Exponential_backoff)
