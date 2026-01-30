import { NextRequest, NextResponse } from 'next/server'
import { startLearnSessionSchema } from '@/lib/learn/schemas'
import { startLearnSession } from '@/lib/learn/services/learnSessionService'
import { withErrorHandler, requireAuth, parseAndValidate } from '@/lib/api'
import { logger } from '@/lib/logger'

/**
 * POST /api/learn/session
 * Starts a learn session with NEW cards for multiple choice quiz.
 * Input: chapterId
 * Output: session data with cards and fallback distractors
 */
async function handler(request: NextRequest) {
  const { user } = await requireAuth()
  const body = await parseAndValidate(request, startLearnSessionSchema)

  const result = await startLearnSession(user.id, body.chapterId)

  if (!result.success) {
    return mapErrorToResponse(result.error, user.id, body.chapterId)
  }

  return NextResponse.json({
    sessionId: result.data.sessionId,
    deckId: result.data.deckId,
    cards: result.data.cards,
    fallbackDistractors: result.data.fallbackDistractors,
    numCards: result.data.numCards
  })
}

/**
 * Maps service errors to HTTP responses.
 */
function mapErrorToResponse(
  error: { type: string; message: string },
  userId: string,
  chapterId: string
): NextResponse {
  switch (error.type) {
    case 'chapter_not_found':
      return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })

    case 'no_new_cards':
      return NextResponse.json(
        { error: 'No new cards to learn in this chapter' },
        { status: 404 }
      )

    case 'deck_not_found':
      return NextResponse.json(
        { error: 'No deck found. Start a study session first.' },
        { status: 404 }
      )

    case 'card_retrieval_failed':
      logger.error(
        { userId, chapterId, message: error.message },
        'Card retrieval failed'
      )
      return NextResponse.json(
        { error: 'Failed to fetch learn cards' },
        { status: 500 }
      )

    default:
      return NextResponse.json(
        { error: 'An unexpected error occurred' },
        { status: 500 }
      )
  }
}

export const POST = withErrorHandler(handler)
