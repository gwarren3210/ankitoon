# Production Issue #3: Missing Rate Limiting

**Severity:** CRITICAL 🔴
**Impact:** High - API abuse, cost explosion, denial of service
**Affected Files:** All API routes
**Financial Risk:** Unlimited OCR/Gemini API costs

---

## Problem Description

AnkiToon has **no rate limiting** on any API endpoints. This exposes
the application to:

1. **Financial Risk**: Unlimited calls to paid APIs (OCR, Gemini)
2. **Denial of Service**: Attacker can exhaust server resources
3. **Data Scraping**: Competitors can scrape all vocabulary data
4. **Abuse**: Malicious users can spam the system

### Current State

```typescript
// src/app/api/admin/process-image/route.ts
export const POST = withErrorHandler(async (request: Request) => {
  // ✅ Auth check
  const user = await requireAdmin(request)

  // ❌ NO RATE LIMIT CHECK

  // Calls expensive external APIs
  const ocrResult = await processImage(imageUrl) // $0.05
  const vocabulary = await extractWords(text)     // $0.05

  // Total: $0.10 per request
})
```

**An attacker could:**
- Upload 10,000 images in 1 hour
- Cost you $1,000 in API fees
- System has no way to stop them

---

## Current Mitigation Factors

**Status:** Issue severity is reduced by current deployment constraints,
but should still be addressed for production hardening.

### Why This Is Not Currently Critical

1. **Free Tier Rate Limiting**
   - OCR.space and Gemini APIs both have built-in free tier rate
     limits enforced by the providers
   - These act as an external rate limit, preventing truly unlimited
     usage
   - Limits are provider-controlled and may change without notice

2. **Admin-Only Access**
   - Image processing endpoints (`/api/admin/process-image`) require
     admin authentication
   - Only admin users can trigger expensive API calls
   - Smaller attack surface compared to public endpoints

3. **Current Scale**
   - Small number of admin users (fewer than 5)
   - Controlled deployment environment
   - Manual oversight of API usage

### Why This Still Matters

**This is NOT a permanent solution:**

1. **Relying on External Limits Is Risky**
   - Provider rate limits can change without notice
   - May not align with your budget constraints
   - No control over limit windows or thresholds

2. **Admin Account Compromise**
   - If admin credentials leak, attacker still has access
   - No defense-in-depth protection
   - Single point of failure

3. **Scaling Concerns**
   - As you add more admins, risk multiplies
   - No way to set budget caps
   - Can't predict or control costs

4. **Production Best Practices**
   - Defense-in-depth requires application-level rate limiting
   - Industry standard for any production API
   - Enables cost monitoring and budgeting

### Recommendation

**Current Status:** Acceptable for beta/internal deployment with manual
oversight

**Before Production Launch:** Implement application-level rate limiting
as described in this document

**Priority:** Address in Week 1 of production readiness roadmap
(currently scheduled, not blocked)

---

## Financial Impact Analysis

### API Cost Breakdown

| Service | Cost per Request | Monthly Limit | Overage Cost |
|---------|-----------------|---------------|--------------|
| OCR.space | $0.05 | 25,000 requests | $0.06/request |
| Gemini API | $0.05 | Varies | $0.07/1K tokens |
| Supabase Storage | ~$0.001 | 100GB | $0.021/GB |

### Attack Scenarios

#### Scenario 1: Malicious Actor
```
Attacker discovers /api/admin/process-image endpoint
Creates script to upload images in loop
Runs for 24 hours before detection

Requests: 10 per second × 86,400 seconds = 864,000 requests
OCR Cost: 864,000 × $0.05 = $43,200
Gemini Cost: 864,000 × $0.05 = $43,200
Total: $86,400 in one day
```

#### Scenario 2: Bug in Client Code
```
Frontend bug causes infinite retry loop
Each failed request retries immediately
1,000 users affected

Requests: 1,000 users × 100 retries = 100,000 requests
Cost: 100,000 × $0.10 = $10,000
Detection time: 1-2 hours
```

#### Scenario 3: Competitor Scraping
```
Competitor scrapes all vocabulary data
Iterates through all series and chapters
Downloads full database

Requests: 5,000 chapters × 10 requests each = 50,000 requests
Time: 2-3 hours
Impact: Intellectual property theft + server load
```

---

## Vulnerable Endpoints by Risk Level

### CRITICAL - Expensive External API Calls 💰

1. **`POST /api/admin/process-image`**
   - Calls OCR.space ($0.05) + Gemini ($0.05)
   - Cost: $0.10 per request
   - No limit could cost thousands per hour
   - **Recommended limit:** 10 requests per hour per admin

2. **`POST /api/admin/series/create`** (if exists)
   - May trigger automated processing
   - **Recommended limit:** 5 requests per hour per admin

### HIGH - Resource Intensive Operations 🔥

3. **`POST /api/study/session`**
   - Creates session in Redis + PostgreSQL
   - Database writes + cache operations
   - **Recommended limit:** 100 sessions per hour per user

4. **`POST /api/study/rate`**
   - Updates FSRS algorithm, writes to DB
   - Could spam with incorrect ratings
   - **Recommended limit:** 1000 ratings per hour per user

5. **`POST /api/profile/avatar`**
   - Uploads files to Supabase Storage
   - 5MB limit per file, but unlimited uploads
   - **Recommended limit:** 10 uploads per hour per user

### MEDIUM - Data Access 📊

6. **`GET /api/series`**
   - Returns series data (could scrape catalog)
   - **Recommended limit:** 100 requests per minute per user

7. **`GET /api/study/cards`**
   - Returns vocabulary cards
   - **Recommended limit:** 50 requests per minute per user

8. **`GET /api/library`**
   - User's library data
   - **Recommended limit:** 60 requests per minute per user

### LOW - Simple Operations ✅

9. **`PATCH /api/profile/settings`**
   - Updates user settings
   - Cheap operation but could harass users
   - **Recommended limit:** 20 requests per hour per user

---

## Why This Matters

### Real Production Incidents (Industry Examples)

#### Case 1: Vercel User - $72K Bill
A developer left a recursive API call in production. No rate limiting.
The function called itself infinitely. Bill went from $50/month to
$72,000 in one weekend.

#### Case 2: OpenAI API Abuse
Startup exposed API key in client code. Attacker used it to make 1M+
requests to GPT-4. Cost: $120,000. Company went bankrupt.

#### Case 3: GitHub Copilot Bug
Bug caused infinite retry loop. Without rate limiting on client side,
users made millions of requests. GitHub's rate limiting prevented
catastrophic cost, but caused service degradation.

### Your Specific Risks

1. **Admin Account Compromise**
   - If admin credentials leak, attacker has unlimited API access
   - No rate limit means unlimited damage

2. **Client-Side Bugs**
   - JavaScript bug could cause retry storm
   - React useEffect dependency issue could cause infinite requests

3. **Deliberate Abuse**
   - Disgruntled user could sabotage before account deletion
   - Competitor could scrape all data

4. **Cost Uncertainty**
   - Can't budget API costs without usage limits
   - Surprise bills block growth

---

## Recommended Solution

### Strategy: Multi-Layer Rate Limiting

Use different rate limits based on:
1. **Endpoint sensitivity** (expensive vs cheap operations)
2. **User role** (admin vs regular user vs anonymous)
3. **Time window** (per second, minute, hour, day)

### Architecture

```
Request → Middleware → Rate Limit Check → API Route
                            ↓
                       Redis Counter
                      (distributed)
```

---

## Implementation

### Step 1: Install Dependencies (5 minutes)

```bash
bun add @upstash/ratelimit @upstash/redis
```

**Why Upstash?**
- Built for serverless (Next.js Edge/Vercel)
- Persistent Redis (survives deployments)
- Free tier: 10K requests/day
- Distributed rate limiting (works across multiple servers)

### Step 2: Create Rate Limiter Service (30 minutes)

Create `src/lib/ratelimit/rateLimiter.ts`:

```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import pino from 'pino'

const logger = pino()

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

/**
 * Rate limit configurations for different endpoint types
 */
export const rateLimiters = {
  // CRITICAL: Expensive external API calls
  expensiveApi: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'), // 10 per hour
    analytics: true,
    prefix: 'ratelimit:expensive',
  }),

  // HIGH: Resource-intensive operations
  studySession: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 h'), // 100 per hour
    analytics: true,
    prefix: 'ratelimit:session',
  }),

  studyRating: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, '1 h'), // 1000 per hour
    analytics: true,
    prefix: 'ratelimit:rating',
  }),

  fileUpload: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 h'), // 10 per hour
    analytics: true,
    prefix: 'ratelimit:upload',
  }),

  // MEDIUM: Data access
  dataAccess: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 per minute
    analytics: true,
    prefix: 'ratelimit:data',
  }),

  // LOW: Simple operations
  simpleOperation: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'), // 20 per hour
    analytics: true,
    prefix: 'ratelimit:simple',
  }),

  // Anonymous users (not logged in)
  anonymous: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 per minute
    analytics: true,
    prefix: 'ratelimit:anon',
  }),
}

/**
 * Checks rate limit for a user/identifier
 *
 * @param identifier - User ID or IP address
 * @param limiter - Which rate limiter to use
 * @returns Object with success flag and rate limit info
 */
export async function checkRateLimit(
  identifier: string,
  limiter: Ratelimit
): Promise<{
  success: boolean
  limit: number
  remaining: number
  reset: number
}> {
  const { success, limit, remaining, reset } = await limiter.limit(identifier)

  // Log rate limit violations
  if (!success) {
    logger.warn(
      {
        identifier,
        limit,
        remaining,
        reset: new Date(reset),
      },
      'Rate limit exceeded'
    )
  }

  return { success, limit, remaining, reset }
}

/**
 * Gets identifier for rate limiting (user ID or IP)
 *
 * @param userId - User ID if authenticated
 * @param request - Request object to extract IP
 * @returns Identifier string for rate limiting
 */
export function getRateLimitIdentifier(
  userId: string | null,
  request: Request
): string {
  // Use user ID if authenticated
  if (userId) {
    return `user:${userId}`
  }

  // Fall back to IP address for anonymous users
  const ip = getClientIp(request)
  return `ip:${ip}`
}

/**
 * Extracts client IP address from request
 *
 * @param request - Request object
 * @returns Client IP address
 */
function getClientIp(request: Request): string {
  // Check Vercel/Cloudflare headers
  const headers = request.headers
  const forwarded = headers.get('x-forwarded-for')
  const realIp = headers.get('x-real-ip')
  const cfConnectingIp = headers.get('cf-connecting-ip')

  if (cfConnectingIp) return cfConnectingIp
  if (realIp) return realIp
  if (forwarded) return forwarded.split(',')[0].trim()

  return 'unknown'
}
```

### Step 3: Create Rate Limit Middleware (20 minutes)

Update `src/middleware.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import {
  rateLimiters,
  checkRateLimit,
  getRateLimitIdentifier,
} from '@/lib/ratelimit/rateLimiter'
import { createClient } from '@/lib/supabase/server'

export async function middleware(request: NextRequest) {
  // Get user ID if authenticated
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const identifier = getRateLimitIdentifier(user?.id ?? null, request)

  // Determine which rate limiter to use based on path
  const limiter = selectRateLimiter(request.nextUrl.pathname)

  if (limiter) {
    const result = await checkRateLimit(identifier, limiter)

    if (!result.success) {
      // Rate limit exceeded
      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          message: 'Please try again later',
          limit: result.limit,
          reset: new Date(result.reset).toISOString(),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.reset.toString(),
            'Retry-After': Math.ceil(
              (result.reset - Date.now()) / 1000
            ).toString(),
          },
        }
      )
    }

    // Add rate limit headers to successful response
    const response = NextResponse.next()
    response.headers.set('X-RateLimit-Limit', result.limit.toString())
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
    response.headers.set('X-RateLimit-Reset', result.reset.toString())
    return response
  }

  return NextResponse.next()
}

/**
 * Selects appropriate rate limiter based on request path
 *
 * @param pathname - Request pathname
 * @returns Rate limiter or null if no limit
 */
function selectRateLimiter(pathname: string) {
  // Expensive API operations
  if (pathname.startsWith('/api/admin/process-image')) {
    return rateLimiters.expensiveApi
  }

  // File uploads
  if (pathname.includes('/api/profile/avatar')) {
    return rateLimiters.fileUpload
  }

  // Study operations
  if (pathname === '/api/study/session') {
    return rateLimiters.studySession
  }
  if (pathname === '/api/study/rate') {
    return rateLimiters.studyRating
  }

  // Data access
  if (pathname.startsWith('/api/series') || pathname.startsWith('/api/study')) {
    return rateLimiters.dataAccess
  }

  // Settings updates
  if (pathname.includes('/api/profile/settings')) {
    return rateLimiters.simpleOperation
  }

  // No rate limit for other endpoints
  return null
}

export const config = {
  matcher: ['/api/:path*'],
}
```

### Step 4: Add Client-Side Error Handling (15 minutes)

Update `src/lib/api/client.ts`:

```typescript
/**
 * Fetch wrapper with rate limit error handling
 */
export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(url, options)

  // Handle rate limit errors
  if (response.status === 429) {
    const data = await response.json()
    const resetDate = new Date(data.reset)
    const waitSeconds = Math.ceil((resetDate.getTime() - Date.now()) / 1000)

    throw new RateLimitError(
      `Rate limit exceeded. Try again in ${waitSeconds} seconds.`,
      {
        limit: data.limit,
        reset: resetDate,
        waitSeconds,
      }
    )
  }

  return response
}

/**
 * Custom error for rate limiting
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public details: { limit: number; reset: Date; waitSeconds: number }
  ) {
    super(message)
    this.name = 'RateLimitError'
  }
}
```

Update components to handle rate limit errors:

```typescript
// src/components/study/StudySession.tsx
try {
  await rateCard(cardId, rating)
} catch (error) {
  if (error instanceof RateLimitError) {
    toast.error(
      `Too many ratings. Please wait ${error.details.waitSeconds} seconds.`
    )
  } else {
    toast.error('Failed to rate card')
  }
}
```

### Step 5: Add Environment Variables (5 minutes)

Update `.env.local`:

```bash
# Upstash Redis (for rate limiting)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

Update `.env.example`:

```bash
# Upstash Redis (for distributed rate limiting)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

---

## Advanced: Per-User Role Limits

Different limits for different user types:

```typescript
/**
 * Gets rate limiter based on user role
 */
function getRateLimiterForUser(user: User | null, endpoint: string) {
  // Admins get higher limits
  if (user?.role === 'admin') {
    if (endpoint === '/api/admin/process-image') {
      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(50, '1 h'), // 50 per hour for admins
      })
    }
  }

  // Premium users get higher limits
  if (user?.subscription === 'premium') {
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(200, '1 h'), // 200 per hour
    })
  }

  // Regular users
  return rateLimiters.studySession
}
```

---

## Testing Approach

### Unit Tests

Create `src/lib/ratelimit/__tests__/rateLimiter.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'bun:test'
import { checkRateLimit, rateLimiters } from '../rateLimiter'

describe('Rate Limiter', () => {
  beforeEach(async () => {
    // Clear rate limit data
    await redis.flushdb()
  })

  it('should allow requests within limit', async () => {
    const result = await checkRateLimit('user:123', rateLimiters.studyRating)
    expect(result.success).toBe(true)
    expect(result.remaining).toBeLessThan(result.limit)
  })

  it('should block requests exceeding limit', async () => {
    const limiter = rateLimiters.expensiveApi // 10 per hour

    // Make 10 requests (should all succeed)
    for (let i = 0; i < 10; i++) {
      const result = await checkRateLimit('user:123', limiter)
      expect(result.success).toBe(true)
    }

    // 11th request should fail
    const result = await checkRateLimit('user:123', limiter)
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('should reset after time window', async () => {
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(1, '1 s'), // 1 per second for testing
    })

    // First request succeeds
    const first = await checkRateLimit('user:123', limiter)
    expect(first.success).toBe(true)

    // Immediate second request fails
    const second = await checkRateLimit('user:123', limiter)
    expect(second.success).toBe(false)

    // Wait 1 second
    await new Promise((resolve) => setTimeout(resolve, 1100))

    // Third request succeeds (window reset)
    const third = await checkRateLimit('user:123', limiter)
    expect(third.success).toBe(true)
  })

  it('should isolate different users', async () => {
    const limiter = rateLimiters.expensiveApi // 10 per hour

    // User 1 makes 10 requests
    for (let i = 0; i < 10; i++) {
      await checkRateLimit('user:1', limiter)
    }

    // User 2 should still have full limit
    const result = await checkRateLimit('user:2', limiter)
    expect(result.success).toBe(true)
    expect(result.remaining).toBe(9)
  })
})
```

### Integration Tests

```typescript
describe('Rate Limiting Integration', () => {
  it('should rate limit expensive API endpoint', async () => {
    // Make 10 requests (limit for expensiveApi)
    for (let i = 0; i < 10; i++) {
      const response = await fetch('/api/admin/process-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ imageUrl: 'test.jpg' }),
      })
      expect(response.status).toBe(200)
    }

    // 11th request should be rate limited
    const response = await fetch('/api/admin/process-image', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ imageUrl: 'test.jpg' }),
    })

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBeDefined()
  })

  it('should include rate limit headers', async () => {
    const response = await fetch('/api/study/session', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    })

    expect(response.headers.get('X-RateLimit-Limit')).toBe('100')
    expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined()
    expect(response.headers.get('X-RateLimit-Reset')).toBeDefined()
  })
})
```

### Load Testing

```bash
# Install Apache Bench
brew install apache-bench

# Test rate limiting under load
ab -n 1000 -c 10 \
  -H "Authorization: Bearer $TOKEN" \
  -m POST \
  http://localhost:3000/api/study/session

# Expected: First 100 succeed, rest get 429
```

---

## Monitoring & Alerts

### Metrics to Track

1. **Rate Limit Hits**
   - How many requests get blocked
   - By endpoint and user

2. **Rate Limit Headroom**
   - How close users get to limits
   - Indicates if limits are too strict

3. **Cost Tracking**
   - Actual API costs vs budget
   - Alert if exceeds $100/day

### Implementation

```typescript
// Add to rate limiter
if (!success) {
  logger.warn(
    {
      identifier,
      endpoint: pathname,
      limit,
      remaining,
    },
    'Rate limit exceeded'
  )

  // Send to analytics
  // analytics.track('rate_limit_exceeded', { ... })

  // Increment alert counter
  // if (shouldAlert(identifier)) {
  //   sendAlert('Possible attack detected')
  // }
}
```

### Cost Monitoring

Create `src/lib/monitoring/costTracker.ts`:

```typescript
/**
 * Tracks API costs for monitoring
 */
export async function trackApiCost(
  service: 'ocr' | 'gemini',
  cost: number,
  userId: string
) {
  const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  await redis.hincrby(`costs:${date}`, service, cost * 100) // Store as cents
  await redis.hincrby(`costs:${date}:user:${userId}`, service, cost * 100)

  // Set expiry to 30 days
  await redis.expire(`costs:${date}`, 30 * 24 * 60 * 60)

  // Check if daily budget exceeded
  const totalCents = await redis.hgetall(`costs:${date}`)
  const totalDollars = Object.values(totalCents).reduce(
    (sum, cents) => sum + Number(cents),
    0
  ) / 100

  if (totalDollars > 100) {
    logger.error({ totalDollars, date }, 'Daily API budget exceeded!')
    // Send alert
  }
}
```

---

## Rollout Strategy

### Phase 1: Monitoring Only (Week 1)
- Deploy rate limiters with high limits (10x normal)
- Monitor actual usage patterns
- Identify baseline traffic

### Phase 2: Soft Limits (Week 2)
- Lower limits to 2x expected usage
- Monitor for false positives
- Adjust based on feedback

### Phase 3: Production Limits (Week 3)
- Set final production limits
- Enable cost alerts
- Document limits in API docs

---

## Success Criteria

✅ All expensive endpoints have rate limits
✅ API costs stay under $100/day
✅ Zero legitimate users blocked
✅ Rate limit headers included in responses
✅ Client gracefully handles 429 errors
✅ Monitoring and alerting operational
✅ Load tests pass with rate limiting enabled

---

## Cost Savings Projection

**Current Risk:**
- Unlimited API usage
- Potential cost: $1,000+ per day if abused

**With Rate Limiting:**
- Max 10 image uploads/hour/admin × 5 admins = 50/hour
- Max cost/day: 50 × 24 × $0.10 = $120/day
- Max cost/month: $3,600 (vs unlimited)

**ROI:** Rate limiting pays for itself with a single prevented attack.

---

## References

- [@upstash/ratelimit Documentation](https://github.com/upstash/ratelimit)
- [Vercel Rate Limiting Guide](https://vercel.com/docs/functions/edge-middleware/rate-limiting)
- [OWASP API Security: Rate Limiting](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)
- [Sliding Window Algorithm Explained](https://engineering.grab.com/frequency-capping)
