import { NextRequest } from 'next/server'
import { sessionRequestSchema } from '@/lib/study/schemas'
import { handleStartSession } from '@/app/api/study/session/startSession'
import { handleEndSession } from '@/app/api/study/session/endSession'
import { withErrorHandler, requireAuth, parseAndValidate } from '@/lib/api'
import { logger } from '@/lib/logger'

/**
 * POST /api/study/session
 * Start: Creates a new study session and returns cards + session ID
 * End: Persists session logs and updates SRS cards to database
 * Input: chapterId (start) or sessionId (end)
 * Output: session data (start) or success (end)
 */
async function handler(request: NextRequest) {
  // DEBUG: Log route entry
  logger.info({ path: request.nextUrl.pathname }, 'Session API route handler entered')

  const { user, supabase } = await requireAuth()
  const body = await parseAndValidate(request, sessionRequestSchema)

  // Determine if this is start or end request based on validated data
  if ('sessionId' in body) {
    return await handleEndSession(supabase, user.id, body.sessionId)
  } else {
    return await handleStartSession(supabase, user.id, body.chapterId)
  }
}

export const POST = withErrorHandler(handler)
