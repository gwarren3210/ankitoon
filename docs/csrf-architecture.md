# CSRF Protection Architecture

This document describes the Cross-Site Request Forgery (CSRF) protection
implementation in AnkiToon, including the token flow, client-server
interaction, and security guarantees.

## Overview

AnkiToon uses the `@edge-csrf/nextjs` library (v2.5.3) which implements a
**signed token pattern** for CSRF protection. This is more secure than simple
double-submit cookie patterns because tokens are cryptographically derived
from a secret, preventing token forgery.

## Token Pattern

### Signed Token vs Double-Submit

| Pattern | How It Works | Security |
|---------|--------------|----------|
| **Simple Double-Submit** | Cookie = Token, Header = Token | Vulnerable if attacker can set cookies |
| **Signed Token** (used) | Cookie = Secret, Header = Hash(Secret + Salt) | Secure even if attacker sets cookies |

The signed token pattern ensures that even if an attacker can somehow set
cookies (via subdomain or other vectors), they cannot forge a valid token
without knowing the secret.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GET Request (Page Load)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Browser                     Proxy (middleware)              Server         │
│     │                              │                            │           │
│     │─── GET /study ──────────────>│                            │           │
│     │                              │                            │           │
│     │                              │── Generate secret ─────────│           │
│     │                              │   secret = random(18 bytes)│           │
│     │                              │                            │           │
│     │                              │── Generate token ──────────│           │
│     │                              │   salt = random(8 bytes)   │           │
│     │                              │   hash = SHA1(secret+salt) │           │
│     │                              │   token = [0,8,salt,hash]  │           │
│     │                              │                            │           │
│     │<── Set-Cookie: secret ───────│                            │           │
│     │<── X-CSRF-Token: token ──────│                            │           │
│     │<── HTML Response ────────────│<───────────────────────────│           │
│     │                              │                            │           │
│  [Store token in sessionStorage]   │                            │           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          POST Request (Form Submit)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Browser                     Proxy (middleware)              Server         │
│     │                              │                            │           │
│     │─── POST /api/study/rate ────>│                            │           │
│     │    Cookie: secret            │                            │           │
│     │    X-CSRF-Token: token       │                            │           │
│     │                              │                            │           │
│     │                              │── Validate ────────────────│           │
│     │                              │   1. Extract salt from token│          │
│     │                              │   2. Get secret from cookie │          │
│     │                              │   3. Compute SHA1(secret+salt)         │
│     │                              │   4. Compare with hash in token        │
│     │                              │                            │           │
│     │                              │── If valid ────────────────>│          │
│     │                              │                            │           │
│     │<── Response ─────────────────│<───────────────────────────│           │
│     │<── X-CSRF-Token: new_token ──│   (fresh token for next)   │           │
│     │                              │                            │           │
│  [Update token in sessionStorage]  │                            │           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Token Format

The CSRF token is a binary structure encoded in base64:

```
┌────────┬────────────┬─────────────────┬──────────────────────┐
│ Byte 0 │   Byte 1   │  Bytes 2-(1+N)  │   Bytes (2+N)-end    │
├────────┼────────────┼─────────────────┼──────────────────────┤
│   0    │ Salt Length│      Salt       │   SHA-1 Hash (20B)   │
│        │    (N)     │   (N bytes)     │                      │
└────────┴────────────┴─────────────────┴──────────────────────┘
```

Default configuration:
- Salt length: 8 bytes
- Secret length: 18 bytes
- Hash: SHA-1 (20 bytes)
- Total token size: ~30 bytes before base64 encoding

## Implementation Details

### Server Side (`src/proxy.ts`)

```typescript
import { createCsrfProtect, CsrfError } from '@edge-csrf/nextjs'

const csrfProtect = createCsrfProtect({
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    name: process.env.NODE_ENV === 'production'
      ? '__Host-toonky.x-csrf-token'  // Secure prefix in production
      : 'toonky.x-csrf-token',
    sameSite: 'strict',
    httpOnly: false,  // Must be readable for debugging, but not used by client
    path: '/',
  },
  excludePathPrefixes: ['/_next', '/static', '/favicon.ico'],
})

export async function proxy(request: NextRequest) {
  const response = await updateSession(request)

  // Skip CSRF for redirects
  if (response.status >= 300 && response.status < 400) {
    return response
  }

  try {
    await csrfProtect(request, response)
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json(
        { error: 'CSRF validation failed', code: 'CSRF_ERROR' },
        { status: 403 }
      )
    }
    throw error
  }

  return response
}
```

### Client Side (`src/lib/api/client.ts`)

```typescript
const CSRF_RESPONSE_HEADER = 'X-CSRF-Token'
const CSRF_STORAGE_KEY = 'csrf-token'

// Get token from sessionStorage
function getCsrfToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(CSRF_STORAGE_KEY)
}

// Store token from response header
function storeCsrfToken(response: Response): void {
  const token = response.headers.get(CSRF_RESPONSE_HEADER)
  if (token && typeof window !== 'undefined') {
    sessionStorage.setItem(CSRF_STORAGE_KEY, token)
  }
}

// Fetch wrapper with automatic CSRF handling
export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase()

  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    let csrfToken = getCsrfToken()

    // Fetch token if not cached
    if (!csrfToken) {
      const response = await fetch('/api/health', { method: 'GET' })
      storeCsrfToken(response)
      csrfToken = getCsrfToken()
    }

    headers.set('X-CSRF-Token', csrfToken)
  }

  const response = await fetch(url, { ...options, headers })

  // Always update token from response
  storeCsrfToken(response)

  return response
}
```

## Security Properties

### What This Protects Against

1. **Cross-Site Request Forgery (CSRF)**
   - Malicious sites cannot forge valid tokens
   - Even with cookies sent automatically, requests fail without valid token

2. **Cookie Injection Attacks**
   - Unlike simple double-submit, attacker-set cookies don't help
   - Token must be derived from the secret, which attacker doesn't know

3. **Token Replay (Limited)**
   - Tokens are refreshed on each response
   - Old tokens may still work until secret expires

### Defense in Depth

Additional protections beyond CSRF tokens:

1. **Origin Header Verification** (`src/proxy.ts`)
   - Validates `Origin` header against allowlist
   - Blocks requests from unknown origins

2. **SameSite Cookie Attribute**
   - Set to `strict` to prevent cross-site cookie sending
   - Provides browser-level protection

3. **`__Host-` Cookie Prefix** (production)
   - Ensures cookie is only set by HTTPS
   - Prevents subdomain cookie attacks

## Cookie Naming Convention

| Environment | Cookie Name | Prefix Meaning |
|-------------|-------------|----------------|
| Development | `toonky.x-csrf-token` | No security prefix |
| Production | `__Host-toonky.x-csrf-token` | Secure, HTTPS-only, no subdomain |

The `__Host-` prefix is a browser security feature that enforces:
- Cookie must be set with `Secure` flag
- Cookie must be set from HTTPS origin
- Cookie must have `Path=/`
- Cookie cannot be set by subdomains

## Token Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│                        Token Lifecycle                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User visits page                                             │
│     └─> GET request                                              │
│         └─> Server generates secret + token                      │
│             └─> Secret stored in cookie                          │
│             └─> Token sent in X-CSRF-Token header                │
│                 └─> Client stores token in sessionStorage        │
│                                                                  │
│  2. User submits form                                            │
│     └─> Client retrieves token from sessionStorage               │
│         └─> POST request with X-CSRF-Token header                │
│             └─> Server validates token against cookie secret     │
│                 └─> If valid, process request                    │
│                 └─> New token returned in response header        │
│                     └─> Client updates sessionStorage            │
│                                                                  │
│  3. Token refresh                                                │
│     └─> Every response includes fresh token                      │
│         └─> Client always updates stored token                   │
│             └─> Ensures token stays in sync with secret          │
│                                                                  │
│  4. Session end                                                  │
│     └─> User closes browser/tab                                  │
│         └─> sessionStorage cleared (per-tab)                     │
│             └─> Token gone, new one fetched on next visit        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Error Handling

### CSRF Validation Failure

When CSRF validation fails, the server returns:

```json
{
  "error": "CSRF validation failed",
  "code": "CSRF_ERROR"
}
```

HTTP Status: `403 Forbidden`

### Client-Side Handling

```typescript
try {
  const response = await postJson('/api/study/session', data)
} catch (error) {
  if (error instanceof CsrfValidationError) {
    // Token invalid or expired
    // Clear stored token and retry
    sessionStorage.removeItem('csrf-token')
    // Optionally: refresh page or fetch new token
  }
}
```

## Debugging

### Server-Side Debug Logging

When CSRF validation fails, the proxy logs:

```javascript
{
  path: '/api/study/session',
  hasHeader: true,
  headerPreview: 'abc123...',
  hasCookie: true,
  cookiePreview: 'xyz789...',
  tokensMatch: false,  // Header vs cookie (for debugging, not validation)
  errorMessage: 'csrf validation error'
}
```

### Common Issues

| Symptom | Cause | Solution |
|---------|-------|----------|
| `tokensMatch: true` but fails | Client sending secret, not token | Read from response header, not cookie |
| Missing token | First request, no GET done | `fetchCsrfToken()` before POST |
| Token expired | Server restarted | Clear sessionStorage, fetch new token |
| `__Host-` cookie not set | HTTP in production | Ensure HTTPS |

## Testing

### Manual Testing

```bash
# 1. Get a token via GET request
curl -c cookies.txt -v http://localhost:3000/api/health 2>&1 | grep X-CSRF-Token
# Note the X-CSRF-Token response header value

# 2. Make POST with token
curl -b cookies.txt \
  -H "X-CSRF-Token: <token-from-step-1>" \
  -H "Content-Type: application/json" \
  -d '{"test": true}' \
  http://localhost:3000/api/study/session

# 3. Verify POST without token fails
curl -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"test": true}' \
  http://localhost:3000/api/study/session
# Should return 403
```

### Automated Tests

See `src/__tests__/proxy.test.ts` for unit tests covering:
- Origin validation
- CSRF error handling
- Redirect bypass

## References

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [@edge-csrf/nextjs Source](https://github.com/kubetail-org/edge-csrf)
- [Cookie Prefixes (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#cookie_prefixes)
- [SameSite Cookies Explained](https://web.dev/samesite-cookies-explained/)
