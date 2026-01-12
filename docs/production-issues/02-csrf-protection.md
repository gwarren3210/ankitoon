# Production Issue #2: Missing CSRF Protection

**Status:** ✅ RESOLVED (2026-01-11, updated 2026-01-12)
**Severity:** CRITICAL 🔴
**Impact:** High - Application vulnerable to cross-site request forgery
**Affected Files:** All API routes (POST/PUT/DELETE)
**Attack Vector:** Malicious websites can perform actions as logged-in users

---

## ✅ Resolution Summary

**Initial Implementation:** 2026-01-11
**Bug Fix:** 2026-01-12 (token handling)
**Approach:** Signed token pattern with `@edge-csrf/nextjs`

### What Was Implemented

1. **CSRF Protection in Proxy** (`src/proxy.ts`)
   - Integrated CSRF validation into existing Next.js proxy handler
   - Configured cryptographic token generation and validation
   - Added origin header verification as defense-in-depth
   - Uses `SameSite=Strict` and conditional `__Host-` prefix for production

2. **Client-Side API Wrapper** (`src/lib/api/client.ts`)
   - Created `fetchWithCsrf()` wrapper that auto-includes CSRF tokens
   - Added convenience methods: `postJson()`, `patchJson()`, `postFormData()`, `deleteRequest()`
   - Implemented `CsrfValidationError` for clear error handling
   - Tokens stored in `sessionStorage` and obtained from response headers

3. **Updated All API Calls**
   - Study hooks: `useRatingSubmission.ts`, `useStudySession.ts`
   - Profile forms: `profileInfoForm.tsx`, `settingsTab.tsx`, `studySettingsForm.tsx`
   - Admin interface: `admin/page.tsx`

4. **Error Handling**
   - Added `CSRF_ERROR` to error code enum in `errors.ts`
   - Returns 403 with clear JSON error message for CSRF failures

### How It Works

The `@edge-csrf/nextjs` library uses a **signed token pattern** (not simple
double-submit):

1. **Secret Generation**: On GET requests, proxy generates random secret
2. **Secret Storage**: Secret stored in cookie (`httpOnly: false`)
3. **Token Derivation**: Derived token = `base64(salt + SHA1(secret + salt))`
4. **Token Delivery**: Derived token sent in `X-CSRF-Token` response header
5. **Client Storage**: Client stores token from response header in sessionStorage
6. **Token Submission**: Client sends stored token in `X-CSRF-Token` request header
7. **Validation**: Server extracts salt from token, recomputes hash using secret
   from cookie, compares with hash in token
8. **Origin Check**: Additional verification of `Origin` header for API routes

**Important:** The cookie contains the SECRET, not the token. The token is
derived from the secret and must be obtained from response headers.

### Protected Endpoints

All state-changing endpoints now require valid CSRF token:
- ✅ `POST /api/admin/process-image` - Expensive API cost attack prevented
- ✅ `POST /api/profile/avatar` - File upload attack prevented
- ✅ `DELETE /api/profile/avatar` - Avatar deletion attack prevented
- ✅ `POST /api/study/rate` - Study progress sabotage prevented
- ✅ `POST /api/study/session` - Session spam prevented
- ✅ `PATCH /api/profile/settings` - Settings tampering prevented
- ✅ `PATCH /api/profile` - Profile tampering prevented

### Verification

- ✅ Build passes: `bun run build`
- ✅ Type checking passes: `bunx tsc --noEmit`
- ✅ Linting passes: `bun lint` (3 warnings unrelated to CSRF)
- ✅ All client-side fetch calls migrated to CSRF-protected wrappers

### Files Modified

- `src/proxy.ts` - Added CSRF protection to proxy handler
- `src/lib/api/client.ts` - New file with CSRF-aware fetch wrapper
- `src/lib/api/errors.ts` - Added CSRF_ERROR code
- `src/lib/hooks/useRatingSubmission.ts` - Updated to use `postJson()`
- `src/lib/hooks/useStudySession.ts` - Updated to use `postJson()`
- `src/components/profile/profileInfoForm.tsx` - Updated to use client wrapper
- `src/components/profile/settingsTab.tsx` - Updated to use `patchJson()`
- `src/components/profile/studySettingsForm.tsx` - Updated to use `patchJson()`
- `src/app/admin/page.tsx` - Updated to use `postFormData()`
- `package.json` - Added `@edge-csrf/nextjs@2.5.3-cloudflare-rc1`

---

## Bug Fix: Token Handling (2026-01-12)

### Problem

After initial implementation, CSRF validation was failing with:
```
[CSRF] Validation failed: {
  path: '/api/study/session',
  hasHeader: true,
  headerPreview: 'nNz%2BB3z8hpL20Rpd6s...',
  hasCookie: true,
  cookiePreview: 'nNz%2BB3z8hpL20Rpd6s...',
  tokensMatch: true,
  errorMessage: 'csrf validation error'
}
```

The header and cookie values matched exactly, yet validation failed.

### Root Cause

The `@edge-csrf/nextjs` library uses a **signed token pattern**, not simple
double-submit. The original client code was reading the cookie value and
sending it as the header token. However:

- **Cookie contains:** The SECRET (random bytes)
- **Header expects:** A DERIVED TOKEN = `base64(salt + SHA1(secret + salt))`

The library generates the derived token and sends it in the `X-CSRF-Token`
**response header**. The client must:
1. Read the token from the response header (not the cookie!)
2. Store it for subsequent requests
3. Send the stored token in request headers

### Solution

Updated `src/lib/api/client.ts` to:

1. **Store tokens from response headers** in `sessionStorage`:
   ```typescript
   function storeCsrfToken(response: Response): void {
     const token = response.headers.get('X-CSRF-Token')
     if (token) sessionStorage.setItem('csrf-token', token)
   }
   ```

2. **Read tokens from sessionStorage** (not cookies):
   ```typescript
   function getCsrfToken(): string | null {
     return sessionStorage.getItem('csrf-token')
   }
   ```

3. **Fetch token on first request** if not cached:
   ```typescript
   if (!csrfToken) {
     const response = await fetch('/api/health', { method: 'GET' })
     storeCsrfToken(response)
     csrfToken = getCsrfToken()
   }
   ```

4. **Update token from every response** to keep it fresh:
   ```typescript
   const response = await fetch(url, options)
   storeCsrfToken(response)  // Always update
   ```

### Files Changed

- `src/lib/api/client.ts` - Fixed token source (response header vs cookie)

### Lessons Learned

1. **Read the library source code** - The `@edge-csrf` library's token pattern
   is not documented clearly. Reading the source revealed the signed token
   mechanism.

2. **Cookie name is misleading** - The cookie is named `x-csrf-token` but
   contains the secret, not the token. Consider renaming to `x-csrf-secret`
   in future versions.

3. **Debug logging helped** - Adding `tokensMatch` to debug output quickly
   ruled out simple mismatch issues and pointed to the signed token pattern.

See `docs/csrf-architecture.md` for detailed design documentation.

---

## Original Problem Description

## Problem Description

The AnkiToon API has **no CSRF (Cross-Site Request Forgery) protection**
on state-changing endpoints. Any website can trick authenticated users
into making unwanted requests.

### What is CSRF?

CSRF exploits the browser's automatic inclusion of cookies with requests.
If a user is logged into AnkiToon, any website they visit can make
requests to AnkiToon's API using their authentication cookies.

### Attack Example

```html
<!-- Malicious website: evil.com -->
<img src="https://ankitoon.com/api/study/rate" style="display:none">
<form action="https://ankitoon.com/api/admin/process-image" method="POST">
  <input name="imageUrl" value="http://evil.com/exploit.jpg">
</form>
<script>
  // Automatically submit when user visits page
  document.forms[0].submit()
</script>
```

When a logged-in AnkiToon user visits `evil.com`:
1. Their browser automatically sends AnkiToon auth cookies
2. The malicious form submits to AnkiToon API
3. AnkiToon sees valid auth cookies and processes the request
4. User unknowingly triggers expensive image processing

---

## Vulnerable Endpoints

### Critical (Direct Financial/Data Impact)

1. **`POST /api/admin/process-image`**
   - Triggers expensive OCR.space and Gemini API calls
   - Could rack up thousands in API costs
   - **Attack scenario:** Attacker submits hundreds of images

2. **`POST /api/profile/avatar`**
   - Uploads files to Supabase storage
   - Could fill storage quota
   - **Attack scenario:** Upload malicious files to victim's account

3. **`DELETE /api/profile/avatar`**
   - Deletes user's avatar
   - Could harass users
   - **Attack scenario:** Repeatedly delete avatar to frustrate user

### High (User Experience Impact)

4. **`POST /api/study/rate`**
   - Rates flashcards (affects FSRS algorithm)
   - Could sabotage user's study progress
   - **Attack scenario:** Rate all cards as "Again" to reset progress

5. **`POST /api/study/session`**
   - Starts study sessions
   - Could create fake session records
   - **Attack scenario:** Spam sessions to pollute analytics

6. **`PATCH /api/profile/settings`**
   - Updates user preferences
   - Could change language, timezone, etc.
   - **Attack scenario:** Change settings to frustrate user

### Medium (Analytics/Metadata Impact)

7. **`POST /api/library/add`** (if exists)
   - Adds series to user's library
   - Could spam user's library

8. **`DELETE /api/library/remove`** (if exists)
   - Removes series from library
   - Could delete user's curated content

---

## Why This Matters

### Real-World Attack Scenarios

#### Scenario 1: API Cost Attack
```
1. Attacker creates malicious webpage
2. Page contains hidden form targeting /api/admin/process-image
3. Attacker posts link to AnkiToon's Discord/Reddit/Twitter
4. Admin user clicks link while logged in
5. Form auto-submits 100 image processing requests
6. Each request costs $0.10 (OCR + Gemini)
7. Total damage: $10+ in minutes, could scale to thousands
```

#### Scenario 2: Study Progress Sabotage
```
1. Competitor creates "Free Korean Resources" site
2. Site includes hidden iframe to AnkiToon
3. Iframe repeatedly calls POST /api/study/rate with "Again"
4. User's study progress gets destroyed
5. User thinks AnkiToon is buggy and switches to competitor
```

#### Scenario 3: Phishing Combo Attack
```
1. Attacker sends phishing email: "You won a prize!"
2. Email links to attacker's site
3. Site makes CSRF request to change user's email via API
4. If email change has no confirmation, account is hijacked
```

### Why Browser Protections Don't Help

Modern browsers have **SameSite cookie** protection, but:
- SameSite=Lax is default (allows GET CSRF)
- Many browsers still support SameSite=None for compatibility
- Supabase auth cookies may not have SameSite=Strict
- Not all users have latest browsers

**You cannot rely on browser protections alone.**

---

## Current Implementation Analysis

### Authentication Flow

```typescript
// src/app/api/study/rate/route.ts
export const POST = withErrorHandler(async (request: Request) => {
  const supabase = await createClient()

  // ✅ Checks authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new UnauthorizedError('Authentication required')
  }

  // ❌ NO CSRF CHECK HERE
  const body = await request.json()
  // ... process request
})
```

### What's Missing

1. **No CSRF Token Validation**
   - No token generated on page load
   - No token validation in API routes
   - Relies solely on cookie authentication

2. **No Origin Verification**
   - Doesn't check `Origin` or `Referer` headers
   - Accepts requests from any website

3. **No SameSite Cookie Configuration Visible**
   - Can't verify Supabase cookie settings
   - May be using SameSite=Lax (insufficient)

---

## Recommended Solution

### Strategy: Next.js Middleware with CSRF Tokens

Use Next.js middleware to:
1. Generate CSRF tokens for GET requests
2. Validate CSRF tokens for POST/PUT/DELETE requests
3. Verify Origin header as backup

### Architecture

```
Browser                    Next.js Middleware           API Route
  |                              |                          |
  |-- GET /study ---------->    |                          |
  |                              |-- Generate token         |
  |<-- Set-Cookie: csrf=xxx --   |                          |
  |<-- Response with token --    |                          |
  |                              |                          |
  |-- POST /api/study/rate -->   |                          |
  |    X-CSRF-Token: xxx         |                          |
  |                              |-- Validate token         |
  |                              |-- Check origin           |
  |                              |-- Token valid? --------> |
  |                              |                          |
  |<-------------------------- Process request -------------|
```

---

## Implementation

### Step 1: Install CSRF Protection Library (5 minutes)

```bash
bun add @edge-csrf/nextjs
```

### Step 2: Create CSRF Middleware (30 minutes)

Create `src/middleware.ts`:

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createCsrfProtect } from '@edge-csrf/nextjs'

// Initialize CSRF protection
const csrfProtect = createCsrfProtect({
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    name: '__Host-ankitoon.x-csrf-token',
    sameSite: 'strict',
    httpOnly: true,
    path: '/',
  },
  excludePathPrefixes: [
    '/_next',
    '/static',
    '/favicon.ico',
    '/api/health', // Health checks don't need CSRF
  ],
})

/**
 * Middleware to protect against CSRF attacks
 *
 * For GET requests: Generates and sets CSRF token
 * For POST/PUT/DELETE: Validates CSRF token
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Apply CSRF protection
  const csrfError = await csrfProtect(request, response)

  if (csrfError) {
    // CSRF validation failed
    return new NextResponse('CSRF validation failed', {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  // Additional: Verify Origin header for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin')
    const host = request.headers.get('host')

    // Allow requests from same origin or no origin (mobile apps)
    if (origin && !isAllowedOrigin(origin, host)) {
      return new NextResponse('Invalid origin', {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }
  }

  return response
}

/**
 * Checks if origin is allowed to make requests
 */
function isAllowedOrigin(origin: string, host: string | null): boolean {
  if (!host) return false

  // Parse origin and host
  const originHost = new URL(origin).host
  const allowedHosts = [
    host,
    'localhost:3000',
    'ankitoon.com',
    'www.ankitoon.com',
  ]

  return allowedHosts.includes(originHost)
}

// Configure which routes this middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
```

### Step 3: Update API Route Wrapper (15 minutes)

Update `src/lib/api/errorHandler.ts` to expose CSRF token:

```typescript
import { NextRequest } from 'next/server'

/**
 * Gets CSRF token from request (set by middleware)
 */
export function getCsrfToken(request: NextRequest): string | null {
  return request.cookies.get('__Host-ankitoon.x-csrf-token')?.value || null
}

/**
 * Enhanced error handler that includes CSRF token in response
 */
export function withErrorHandler(
  handler: (request: Request) => Promise<Response>
) {
  return async (request: Request) => {
    try {
      const response = await handler(request)

      // Add CSRF token to successful responses
      const token = getCsrfToken(request as NextRequest)
      if (token && response.headers) {
        response.headers.set('X-CSRF-Token', token)
      }

      return response
    } catch (error) {
      // ... existing error handling
    }
  }
}
```

### Step 4: Update Client-Side Fetch Calls (30 minutes)

Create `src/lib/api/client.ts`:

```typescript
/**
 * Fetches CSRF token from cookie
 */
function getCsrfTokenFromCookie(): string | null {
  const match = document.cookie.match(
    /(?:^|;\s*)__Host-ankitoon\.x-csrf-token=([^;]+)/
  )
  return match ? match[1] : null
}

/**
 * Fetch wrapper that automatically includes CSRF token
 *
 * @param url - API endpoint
 * @param options - Fetch options
 * @returns Fetch response
 */
export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const csrfToken = getCsrfTokenFromCookie()

  const headers = new Headers(options.headers)

  // Add CSRF token for state-changing methods
  if (
    options.method &&
    ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method.toUpperCase())
  ) {
    if (!csrfToken) {
      throw new Error('CSRF token not found. Please reload the page.')
    }
    headers.set('X-CSRF-Token', csrfToken)
  }

  // Add JSON content type if body is present
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin', // Include cookies
  })
}
```

### Step 5: Update Existing API Calls (60 minutes)

Replace all `fetch()` calls with `fetchWithCsrf()`:

```typescript
// Before
const response = await fetch('/api/study/rate', {
  method: 'POST',
  body: JSON.stringify({ cardId, rating }),
})

// After
import { fetchWithCsrf } from '@/lib/api/client'

const response = await fetchWithCsrf('/api/study/rate', {
  method: 'POST',
  body: JSON.stringify({ cardId, rating }),
})
```

**Files to update:**
- `src/app/study/[seriesSlug]/[chapterSlug]/page.tsx`
- `src/components/study/StudySession.tsx`
- `src/components/profile/AvatarUpload.tsx`
- Any other components making API calls

---

## Testing Approach

### Unit Tests

Create `src/middleware.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test'
import { NextRequest } from 'next/server'
import { middleware } from './middleware'

describe('CSRF Middleware', () => {
  it('should allow GET requests', async () => {
    const request = new NextRequest('http://localhost:3000/api/study')
    const response = await middleware(request)

    expect(response.status).not.toBe(403)
  })

  it('should block POST without CSRF token', async () => {
    const request = new NextRequest('http://localhost:3000/api/study/rate', {
      method: 'POST',
    })

    const response = await middleware(request)
    expect(response.status).toBe(403)
  })

  it('should allow POST with valid CSRF token', async () => {
    // First request to get token
    const getRequest = new NextRequest('http://localhost:3000/api/study')
    const getResponse = await middleware(getRequest)
    const token = getResponse.cookies.get('__Host-ankitoon.x-csrf-token')

    // Second request with token
    const postRequest = new NextRequest(
      'http://localhost:3000/api/study/rate',
      {
        method: 'POST',
        headers: { 'X-CSRF-Token': token!.value },
      }
    )

    const postResponse = await middleware(postRequest)
    expect(postResponse.status).not.toBe(403)
  })

  it('should block requests from different origin', async () => {
    const request = new NextRequest('http://localhost:3000/api/study/rate', {
      method: 'POST',
      headers: {
        origin: 'http://evil.com',
      },
    })

    const response = await middleware(request)
    expect(response.status).toBe(403)
  })
})
```

### Integration Tests

```typescript
describe('CSRF Protection E2E', () => {
  it('should complete full study session with CSRF', async () => {
    // 1. Load study page (gets CSRF token)
    const page = await browser.newPage()
    await page.goto('http://localhost:3000/study/tower-of-god/chapter-1')

    // 2. Start session
    await page.click('[data-testid="start-session"]')

    // 3. Rate cards (should include CSRF token)
    await page.click('[data-testid="rating-good"]')

    // 4. Verify rating succeeded
    const toast = await page.locator('[data-testid="toast"]')
    expect(await toast.textContent()).toContain('Card rated')
  })

  it('should prevent CSRF attack', async () => {
    // Simulate logged-in user visiting malicious site
    const userPage = await browser.newPage()
    await userPage.goto('http://localhost:3000/login')
    await login(userPage)

    // Visit malicious site
    const attackPage = await browser.newPage()
    await attackPage.setContent(`
      <form id="attack" action="http://localhost:3000/api/study/rate"
            method="POST">
        <input name="cardId" value="123">
        <input name="rating" value="Again">
      </form>
      <script>document.getElementById('attack').submit()</script>
    `)

    // Attack should fail
    await attackPage.waitForNavigation()
    expect(attackPage.url()).toContain('error=403')
  })
})
```

### Manual Testing

1. **Verify token generation:**
   ```bash
   # Load page and check cookie
   curl -c cookies.txt http://localhost:3000/study
   cat cookies.txt | grep csrf
   ```

2. **Test POST without token (should fail):**
   ```bash
   curl -X POST http://localhost:3000/api/study/rate \
     -H "Content-Type: application/json" \
     -d '{"cardId": "123", "rating": "Good"}'

   # Expected: 403 Forbidden
   ```

3. **Test POST with token (should succeed):**
   ```bash
   # Extract token from cookies
   TOKEN=$(cat cookies.txt | grep csrf | awk '{print $7}')

   curl -X POST http://localhost:3000/api/study/rate \
     -H "Content-Type: application/json" \
     -H "X-CSRF-Token: $TOKEN" \
     -b cookies.txt \
     -d '{"cardId": "123", "rating": "Good"}'

   # Expected: 200 OK
   ```

---

## Alternative: Double-Submit Cookie Pattern

If the `@edge-csrf/nextjs` library doesn't meet your needs, you can
implement the double-submit cookie pattern manually:

### How It Works

1. Server sets a random CSRF token in a cookie
2. Client reads cookie and sends token in header
3. Server verifies cookie matches header

### Implementation

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Generate token for GET requests
  if (request.method === 'GET') {
    let token = request.cookies.get('csrf-token')?.value

    if (!token) {
      token = crypto.randomBytes(32).toString('base64url')
      response.cookies.set('csrf-token', token, {
        httpOnly: false, // Client needs to read this
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      })
    }
  }

  // Validate token for POST/PUT/DELETE
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    const cookieToken = request.cookies.get('csrf-token')?.value
    const headerToken = request.headers.get('x-csrf-token')

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      return new NextResponse('CSRF validation failed', { status: 403 })
    }
  }

  return response
}
```

**Pros:**
- Simple implementation
- No external dependencies
- Full control

**Cons:**
- Less secure than cryptographic approach
- No built-in token rotation
- Have to handle edge cases yourself

---

## Monitoring & Alerts

### Metrics to Track

1. **CSRF Validation Failures**
   - Count of blocked requests
   - Alert if > 100 in 1 hour (potential attack)

2. **Missing Token Errors**
   - Indicates client-side bug
   - Alert if > 10 in 1 hour

3. **Origin Header Mismatches**
   - Count of blocked cross-origin requests
   - Alert if > 50 in 1 hour

### Implementation

```typescript
// In middleware.ts
if (csrfError) {
  logger.warn(
    {
      path: request.nextUrl.pathname,
      method: request.method,
      origin: request.headers.get('origin'),
      userAgent: request.headers.get('user-agent'),
    },
    'CSRF validation failed'
  )

  // Increment metric
  // metrics.increment('csrf.validation.failed')

  return new NextResponse('CSRF validation failed', { status: 403 })
}
```

---

## Rollout Strategy

### Phase 1: Logging Only (Week 1)
- Deploy middleware in "log-only" mode
- Don't block requests, just log violations
- Identify any legitimate clients that would break

### Phase 2: Soft Launch (Week 2)
- Enable CSRF protection on non-critical endpoints
- Monitor for client-side errors
- Fix any integration issues

### Phase 3: Full Protection (Week 3)
- Enable CSRF protection on all endpoints
- Monitor attack attempts
- Document any false positives

---

## Success Criteria

✅ All API routes protected by CSRF validation
✅ Zero legitimate requests blocked
✅ Client-side integration working on all pages
✅ Automated tests covering attack scenarios
✅ Monitoring and alerting in place
✅ Security audit passes CSRF checks

---

## References

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [@edge-csrf/nextjs Documentation](https://github.com/kubetail-org/edge-csrf)
- [Next.js Middleware Documentation](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [SameSite Cookie Explained](https://web.dev/samesite-cookies-explained/)
