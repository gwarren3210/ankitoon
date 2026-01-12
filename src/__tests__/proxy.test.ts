/**
 * Proxy/CSRF Tests
 *
 * Tests origin validation and CSRF protection:
 * - Allowed origins (exact strings, regex patterns)
 * - Same-origin bypass
 * - CSRF error handling
 * - Redirect bypass
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test'

// Mock NextResponse
const mockNextResponseJson = mock((body: any, init?: ResponseInit) => ({
  status: init?.status ?? 200,
  body,
  json: async () => body
}))

const mockNextResponseNext = mock(() => ({
  status: 200,
  cookies: { set: mock(() => {}) }
}))

const mockNextResponseRedirect = mock((url: URL) => ({
  status: 302,
  headers: { get: () => url.toString() }
}))

mock.module('next/server', () => ({
  NextResponse: {
    json: mockNextResponseJson,
    next: mockNextResponseNext,
    redirect: mockNextResponseRedirect
  }
}))

// Track CSRF protect calls and errors
let shouldThrowCsrf = false

// Mock @edge-csrf/nextjs
class MockCsrfError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CsrfError'
  }
}

const mockCsrfProtect = mock(async () => {
  if (shouldThrowCsrf) {
    throw new MockCsrfError('CSRF token mismatch')
  }
})

mock.module('@edge-csrf/nextjs', () => ({
  createCsrfProtect: () => mockCsrfProtect,
  CsrfError: MockCsrfError
}))

// Mock supabase proxy
const mockUpdateSession = mock(async () => ({
  status: 200,
  cookies: { set: mock(() => {}) }
}))

mock.module('@/lib/supabase/proxy', () => ({
  updateSession: mockUpdateSession
}))

// Import after mocks
const { proxy } = await import('@/proxy')

// Helper to create mock NextRequest
function createMockRequest(
  pathname: string,
  options: {
    origin?: string | null
    host?: string | null
    method?: string
  } = {}
): any {
  return {
    nextUrl: {
      pathname,
      clone: () => ({ pathname })
    },
    headers: {
      get: (name: string) => {
        if (name === 'origin') return options.origin ?? null
        // Use 'host' in options to check if explicitly set (including null)
        if (name === 'host') {
          return 'host' in options ? options.host : 'localhost:3000'
        }
        return null
      }
    },
    method: options.method ?? 'GET',
    cookies: {
      getAll: () => [],
      set: mock(() => {})
    }
  }
}

describe('proxy', () => {
  beforeEach(() => {
    shouldThrowCsrf = false
    mockCsrfProtect.mockClear()
    mockUpdateSession.mockClear()
    mockNextResponseJson.mockClear()
  })

  describe('origin validation', () => {
    describe('production domains', () => {
      it('allows www.toonky.io', async () => {
        const request = createMockRequest('/api/test', {
          origin: 'https://www.toonky.io',
          host: 'www.toonky.io'
        })

        const response = await proxy(request)

        expect(response.status).toBe(200)
      })

      it('allows toonky.io subdomains', async () => {
        const request = createMockRequest('/api/test', {
          origin: 'https://api.toonky.io',
          host: 'api.toonky.io'
        })

        const response = await proxy(request)

        expect(response.status).toBe(200)
      })

      it('allows staging.toonky.io', async () => {
        const request = createMockRequest('/api/test', {
          origin: 'https://staging.toonky.io',
          host: 'staging.toonky.io'
        })

        const response = await proxy(request)

        expect(response.status).toBe(200)
      })
    })

    describe('development domains', () => {
      it('allows localhost:3000', async () => {
        const request = createMockRequest('/api/test', {
          origin: 'http://localhost:3000',
          host: 'localhost:3000'
        })

        const response = await proxy(request)

        expect(response.status).toBe(200)
      })

      it('allows 127.0.0.1:3000', async () => {
        const request = createMockRequest('/api/test', {
          origin: 'http://127.0.0.1:3000',
          host: '127.0.0.1:3000'
        })

        const response = await proxy(request)

        expect(response.status).toBe(200)
      })

      it('allows localhost on any port', async () => {
        const request = createMockRequest('/api/test', {
          origin: 'http://localhost:5173',
          host: 'localhost:5173'
        })

        const response = await proxy(request)

        expect(response.status).toBe(200)
      })
    })

    describe('Vercel deployments', () => {
      it('allows Git branch deployments', async () => {
        const vercelHost = 'toonky-git-feature-auth-gwarren3210s-projects.vercel.app'
        const request = createMockRequest('/api/test', {
          origin: `https://${vercelHost}`,
          host: vercelHost
        })

        const response = await proxy(request)

        expect(response.status).toBe(200)
      })
    })

    describe('same-origin', () => {
      it('allows same-origin requests', async () => {
        const request = createMockRequest('/api/test', {
          origin: 'https://example.com',
          host: 'example.com'
        })

        const response = await proxy(request)

        // Same origin, should pass
        expect(response.status).toBe(200)
      })
    })

    describe('rejected origins', () => {
      it('rejects unknown origins on API routes', async () => {
        mockUpdateSession.mockImplementation(async () => ({
          status: 200,
          cookies: { set: mock(() => {}) }
        }))

        const request = createMockRequest('/api/test', {
          origin: 'https://malicious-site.com',
          host: 'localhost:3000'
        })

        const response = await proxy(request)

        expect(response.status).toBe(403)
        expect(mockNextResponseJson).toHaveBeenCalledWith(
          { error: 'Invalid origin', code: 'INVALID_ORIGIN' },
          { status: 403 }
        )
      })

      it('rejects partial domain matches', async () => {
        const request = createMockRequest('/api/test', {
          origin: 'https://nottoonky.io',
          host: 'localhost:3000'
        })

        const response = await proxy(request)

        expect(response.status).toBe(403)
      })

      it('rejects subdomain of allowed domain without proper pattern', async () => {
        const request = createMockRequest('/api/test', {
          origin: 'https://fake.localhost:3000.attacker.com',
          host: 'localhost:3000'
        })

        const response = await proxy(request)

        expect(response.status).toBe(403)
      })
    })

    describe('requests without origin', () => {
      it('allows requests without origin header (browser same-origin)', async () => {
        const request = createMockRequest('/api/test', {
          origin: null,
          host: 'localhost:3000'
        })

        const response = await proxy(request)

        // No origin header, no origin check performed
        expect(response.status).toBe(200)
      })
    })

    describe('non-API routes', () => {
      it('skips origin validation for non-API routes', async () => {
        const request = createMockRequest('/dashboard', {
          origin: 'https://malicious-site.com',
          host: 'localhost:3000'
        })

        const response = await proxy(request)

        // Origin check only on /api/ routes
        expect(response.status).toBe(200)
      })
    })
  })

  describe('CSRF protection', () => {
    it('returns 403 on CSRF error', async () => {
      shouldThrowCsrf = true

      const request = createMockRequest('/test', {
        host: 'localhost:3000'
      })

      const response = await proxy(request)

      expect(response.status).toBe(403)
      expect(mockNextResponseJson).toHaveBeenCalledWith(
        { error: 'CSRF validation failed', code: 'CSRF_ERROR' },
        { status: 403 }
      )
    })

    it('applies CSRF protection on non-redirect responses', async () => {
      mockUpdateSession.mockImplementation(async () => ({
        status: 200,
        cookies: { set: mock(() => {}) }
      }))

      const request = createMockRequest('/test', {
        host: 'localhost:3000'
      })

      await proxy(request)

      expect(mockCsrfProtect).toHaveBeenCalled()
    })
  })

  describe('redirect handling', () => {
    it('skips CSRF on redirect responses', async () => {
      mockUpdateSession.mockImplementation(async () => ({
        status: 302,
        cookies: { set: mock(() => {}) }
      }))

      const request = createMockRequest('/protected', {
        host: 'localhost:3000'
      })

      const response = await proxy(request)

      expect(response.status).toBe(302)
      expect(mockCsrfProtect).not.toHaveBeenCalled()
    })

    it('skips CSRF on 301 redirects', async () => {
      mockUpdateSession.mockImplementation(async () => ({
        status: 301,
        cookies: { set: mock(() => {}) }
      }))

      const request = createMockRequest('/old-page', {
        host: 'localhost:3000'
      })

      const response = await proxy(request)

      expect(response.status).toBe(301)
      expect(mockCsrfProtect).not.toHaveBeenCalled()
    })

    it('skips CSRF on 307 temporary redirects', async () => {
      mockUpdateSession.mockImplementation(async () => ({
        status: 307,
        cookies: { set: mock(() => {}) }
      }))

      const request = createMockRequest('/temporary', {
        host: 'localhost:3000'
      })

      const response = await proxy(request)

      expect(response.status).toBe(307)
      expect(mockCsrfProtect).not.toHaveBeenCalled()
    })
  })

  describe('session handling', () => {
    it('calls updateSession for each request', async () => {
      mockUpdateSession.mockImplementation(async () => ({
        status: 200,
        cookies: { set: mock(() => {}) }
      }))

      const request = createMockRequest('/page', {
        host: 'localhost:3000'
      })

      await proxy(request)

      expect(mockUpdateSession).toHaveBeenCalledWith(request)
    })

    it('passes through updateSession response on success', async () => {
      const sessionResponse = {
        status: 200,
        cookies: { set: mock(() => {}) },
        custom: 'data'
      }
      mockUpdateSession.mockImplementation(async () => sessionResponse)

      const request = createMockRequest('/page', {
        host: 'localhost:3000'
      })

      const response = await proxy(request)

      expect(response).toEqual(sessionResponse)
    })
  })
})

// Separate tests for URL parsing edge cases
describe('origin URL parsing', () => {
  beforeEach(() => {
    shouldThrowCsrf = false
    mockCsrfProtect.mockClear()
    mockUpdateSession.mockClear()
    mockUpdateSession.mockImplementation(async () => ({
      status: 200,
      cookies: { set: mock(() => {}) }
    }))
  })

  it('handles malformed origin URLs gracefully', async () => {
    const request = createMockRequest('/api/test', {
      origin: 'not-a-valid-url',
      host: 'localhost:3000'
    })

    const response = await proxy(request)

    // Invalid URL should be rejected
    expect(response.status).toBe(403)
  })

  it('handles origin with different protocol', async () => {
    const request = createMockRequest('/api/test', {
      origin: 'http://localhost:3000', // HTTP not HTTPS
      host: 'localhost:3000'
    })

    const response = await proxy(request)

    // Same host, protocol doesn't affect origin check
    expect(response.status).toBe(200)
  })

  it('rejects null host header', async () => {
    const request = createMockRequest('/api/test', {
      origin: 'https://www.toonky.io',
      host: null
    })

    const response = await proxy(request)

    // Null host should fail origin check
    expect(response.status).toBe(403)
  })
})
