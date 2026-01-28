import { NextResponse } from 'next/server'
import { endStudySession, EndSessionError } from '@/lib/study/sessionService'
import { logger } from '@/lib/logger'

/**
 * Handles ending a study session.
 * Input: user id, session id
 * Output: NextResponse with session end result
 */
export async function handleEndSession(
  userId: string,
  sessionId: string
) {
  const result = await endStudySession(userId, sessionId)

  if (!result.success) {
    return mapErrorToResponse(result.error, userId, sessionId)
  }

  return NextResponse.json({
    success: true,
    cardsStudied: result.data.cardsStudied,
    accuracy: result.data.accuracy,
    timeSpentSeconds: result.data.timeSpentSeconds
  })
}

/**
 * Maps service errors to HTTP responses.
 * Input: end session error, user id, session id
 * Output: NextResponse with appropriate status code
 */
function mapErrorToResponse(
  error: EndSessionError,
  userId: string,
  sessionId: string
): NextResponse {
  switch (error.type) {
    case 'session_not_found':
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 404 }
      )

    case 'unauthorized':
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )

    case 'persistence_failed':
      logger.error(
        { userId, sessionId, message: error.message },
        'Session persistence failed'
      )
      throw new Error(error.message) // Re-throw to be caught by POST handler
  }
}
