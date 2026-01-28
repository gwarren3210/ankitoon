/**
 * Next.js Proxy Handler
 * Handles session management and CSRF protection.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'
import { createCsrfProtect, CsrfError } from '@edge-csrf/nextjs'

/**
 * CSRF protection configuration.
 * Uses double-submit cookie pattern with cryptographic tokens.
 */
const csrfProtect = createCsrfProtect({
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    name: process.env.NODE_ENV === 'production'
      ? '__Host-toonky.x-csrf-token'
      : 'toonky.x-csrf-token',
    sameSite: 'strict',
    httpOnly: false,
    path: '/',
  },
  excludePathPrefixes: [
    '/_next',
    '/static',
    '/favicon.ico',
    '/api/inngest', // Inngest webhook endpoint (has its own signing key auth)
  ],
})

/**
 * Allowed origins for API requests.
 * Supports both exact string matches and regex patterns.
 * Examples:
 * - 'localhost:3000' - exact match
 * - /.*\.vercel\.app$/ - regex for all Vercel preview deployments
 */
const ALLOWED_ORIGINS: (string | RegExp)[] = [
  // Production domains
  'www.toonky.vercel.app',
  'www.toonky.io',
  /.*\.toonky\.io$/, // All toonky.io subdomains

  // Vercel deployments (git branches and preview deployments)
  /toonky-.*-gwarren3210s-projects\.vercel\.app$/,

  // Development
  'localhost:3000',
  '127.0.0.1:3000',
  /localhost:\d+/, // Localhost on any port
]

/**
 * Checks if origin is allowed to make requests.
 * Supports both exact string matches and regex patterns.
 * Input: origin header, host header
 * Output: boolean indicating if origin is valid
 */
function isAllowedOrigin(origin: string, host: string | null): boolean {
  if (!host) return false

  try {
    const originHost = new URL(origin).host

    // Always allow same-origin requests
    if (originHost === host) return true

    // Check against allowed origins (strings and regex)
    return ALLOWED_ORIGINS.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === originHost
      }
      // RegExp pattern
      return allowed.test(originHost)
    })
  } catch {
    return false
  }
}

/**
 * Main proxy handler.
 * Handles Supabase session refresh and CSRF protection.
 */
export async function proxy(request: NextRequest) {
  // First, handle Supabase session
  const response = await updateSession(request)

  // If response is a redirect (e.g., to login), skip CSRF
  if (response.status >= 300 && response.status < 400) {
    return response
  }

  // Apply CSRF protection
  try {
    await csrfProtect(request, response)
  } catch (error) {
    if (error instanceof CsrfError) {
      // DEBUG: Log CSRF failure details
      const csrfHeader = request.headers.get('X-CSRF-Token')
      const cookies = request.headers.get('cookie')
      const cookieName = process.env.NODE_ENV === 'production'
        ? '__Host-toonky.x-csrf-token'
        : 'toonky.x-csrf-token'
      const csrfCookieEntry = cookies?.split(';')
        .find(c => c.trim().startsWith(`${cookieName}=`))
      // Extract value after first '=' to handle tokens with '=' chars
      const csrfCookie = csrfCookieEntry
        ? csrfCookieEntry.trim().substring(cookieName.length + 1)
        : null
      console.error('[CSRF] Validation failed:', {
        path: request.nextUrl.pathname,
        hasHeader: !!csrfHeader,
        headerPreview: csrfHeader?.slice(0, 20) + '...',
        hasCookie: !!csrfCookie,
        cookiePreview: csrfCookie?.slice(0, 20) + '...',
        tokensMatch: csrfHeader === csrfCookie,
        errorMessage: error.message
      })
      return NextResponse.json(
        { error: 'CSRF validation failed', code: 'CSRF_ERROR' },
        { status: 403 }
      )
    }
    throw error
  }

  // Additional origin verification for API routes (defense in depth)
  // Skip for Inngest webhook (uses signing key for auth instead)
  if (
    request.nextUrl.pathname.startsWith('/api/') &&
    !request.nextUrl.pathname.startsWith('/api/inngest')
  ) {
    const origin = request.headers.get('origin')
    const host = request.headers.get('host')

    if (origin && !isAllowedOrigin(origin, host)) {
      return NextResponse.json(
        { error: 'Invalid origin', code: 'INVALID_ORIGIN' },
        { status: 403 }
      )
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
