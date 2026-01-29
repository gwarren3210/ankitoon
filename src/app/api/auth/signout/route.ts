import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { withErrorHandler } from '@/lib/api'

/**
 * POST /api/auth/signout
 * Signs out the current user and redirects to browse.
 * Input: none
 * Output: redirect to /browse (auth modal handles unauthenticated state)
 */
async function handler(request: NextRequest) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    logger.error({ error }, 'Error signing out user')
  }

  // Redirect to browse - auth modal handles unauthenticated state
  const url = request.nextUrl.clone()
  url.pathname = '/browse'
  return NextResponse.redirect(url)
}

export const POST = withErrorHandler(handler)
