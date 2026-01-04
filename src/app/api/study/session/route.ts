import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { sessionRequestSchema } from '@/lib/study/schemas'
import { handleStartSession } from '@/app/api/study/session/startSession'
import { handleEndSession } from '@/app/api/study/session/endSession'

interface StartSessionRequest {
  chapterId: string
}

interface EndSessionRequest {
  sessionId: string
}

/**
 * POST /api/study/session
 * Start: Creates a new study session and returns cards + session ID
 * End: Persists session logs and updates SRS cards to database
 * Input: chapterId (start) or sessionId (end)
 * Output: session data (start) or success (end)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.error({ error: authError }, 'User not found')
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      )
    }

    let body: StartSessionRequest | EndSessionRequest
    try {
      body = await request.json()
    } catch (error) {
      logger.error('Error parsing request body: %s', error)
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const validationResult = sessionRequestSchema.safeParse(body)
    if (!validationResult.success) {
      logger.warn({ 
        userId: user.id, 
        issues: validationResult.error.issues 
      }, 'Validation failed')
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validationResult.error.issues 
        },
        { status: 400 }
      )
    }

    // Determine if this is start or end request
    if ('sessionId' in validationResult.data) {
      return await handleEndSession(supabase, user.id, validationResult.data.sessionId)
    } else {
      return await handleStartSession(supabase, user.id, validationResult.data.chapterId)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    logger.error({ error }, 'Error in /api/study/session')
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}
