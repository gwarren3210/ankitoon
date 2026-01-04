import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * POST /api/auth/signout
 * Signs out the current user and redirects to login
 * Input: none
 * Output: redirect to /login
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      logger.error({ error }, 'Error signing out user')
    } else {
      logger.info('User signed out successfully')
    }
    
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  } catch (error) {
    logger.error({ error }, 'Error in signout handler')
    
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
}

