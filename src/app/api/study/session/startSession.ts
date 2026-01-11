import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startStudySession, StartSessionError } from '@/lib/study/sessionService'
import { logger } from '@/lib/logger'

/**
 * Handles starting a new study session.
 * Input: supabase client, user id, chapter id
 * Output: NextResponse with session data
 */
export async function handleStartSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  chapterId: string
) {
  const result = await startStudySession(supabase, userId, chapterId)

  if (!result.success) {
    return mapErrorToResponse(result.error, userId, chapterId)
  }

  return NextResponse.json({
    sessionId: result.data.sessionId,
    deckId: result.data.deckId,
    cards: result.data.cards,
    numNewCards: result.data.numNewCards,
    numCards: result.data.numCards,
    startTime: result.data.startTime
  })
}

/**
 * Maps service errors to HTTP responses.
 * Input: start session error, user id, chapter id
 * Output: NextResponse with appropriate status code
 */
function mapErrorToResponse(
  error: StartSessionError,
  userId: string,
  chapterId: string
): NextResponse {
  switch (error.type) {
    case 'chapter_not_found':
      return NextResponse.json(
        { error: 'Chapter not found' },
        { status: 404 }
      )

    case 'no_vocabulary':
      return NextResponse.json(
        { error: 'Chapter has no cards' },
        { status: 404 }
      )

    case 'deck_creation_failed':
      logger.error(
        { userId, chapterId, message: error.message },
        'Deck creation failed'
      )
      return NextResponse.json(
        { error: 'Failed to get or create study deck' },
        { status: 500 }
      )

    case 'validation_failed':
      logger.error(
        { userId, chapterId, message: error.message },
        'Validation failed'
      )
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )

    case 'initialization_failed':
      logger.error(
        { userId, chapterId, message: error.message },
        'Card initialization failed'
      )
      return NextResponse.json(
        { error: 'Failed to initialize study cards' },
        { status: 500 }
      )

    case 'card_retrieval_failed':
      logger.error(
        { userId, chapterId, message: error.message },
        'Card retrieval failed'
      )
      return NextResponse.json(
        {
          error: 'Failed to fetch study cards',
          details:
            process.env.NODE_ENV === 'development' ? error.message : undefined
        },
        { status: 500 }
      )

    case 'session_creation_failed':
      logger.error(
        { userId, chapterId, message: error.message },
        'Session creation failed'
      )
      return NextResponse.json(
        {
          error: 'Failed to create session',
          details:
            process.env.NODE_ENV === 'development' ? error.message : undefined
        },
        { status: 500 }
      )
  }
}
