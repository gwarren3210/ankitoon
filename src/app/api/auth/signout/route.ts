import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { withErrorHandler } from '@/lib/api'

/**
 * POST /api/auth/signout
 * Signs out the current user and redirects to login.
 * Input: none
 * Output: redirect to /login
 */
async function handler(request: NextRequest) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    logger.error({ error }, 'Error signing out user')
  } else {
    logger.info('User signed out successfully')
  }

  // Always redirect to login (even on error - good UX)
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  return NextResponse.redirect(url)
}

export const POST = withErrorHandler(handler)
