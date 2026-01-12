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

  // Vercel deployments
  /toonky-git-.*-gwarren3210s-projects\.vercel\.app$/, // Vercel Git branch deployments

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
      return NextResponse.json(
        { error: 'CSRF validation failed', code: 'CSRF_ERROR' },
        { status: 403 }
      )
    }
    throw error
  }

  // Additional origin verification for API routes (defense in depth)
  if (request.nextUrl.pathname.startsWith('/api/')) {
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
