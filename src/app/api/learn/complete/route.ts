import { NextRequest, NextResponse } from 'next/server'
import { completeLearnSessionSchema } from '@/lib/learn/schemas'
import { completeLearnSession } from '@/lib/learn/services/learnSessionService'
import { withErrorHandler, requireAuth, parseAndValidate } from '@/lib/api'
import { logger } from '@/lib/logger'
import { fsrsStateToDbState } from '@/lib/study/utils'

/**
 * POST /api/learn/complete
 * Completes a learn session by persisting graduated cards with FSRS state.
 * Input: sessionId, deckId, graduatedCards (with FSRS card objects)
 * Output: success status and cards graduated count
 */
async function handler(request: NextRequest) {
  const { user } = await requireAuth()
  const body = await parseAndValidate(request, completeLearnSessionSchema)

  // Transform FSRS card objects for the RPC call
  const graduatedCardsForRpc = body.graduatedCards.map((card) => ({
    srsCardId: card.srsCardId,
    state: fsrsStateToDbState(card.fsrsCard.state),
    stability: card.fsrsCard.stability,
    difficulty: card.fsrsCard.difficulty,
    due: card.fsrsCard.due.toISOString(),
    scheduledDays: card.fsrsCard.scheduled_days,
    learningSteps: card.fsrsCard.learning_steps
  }))

  const result = await completeLearnSession(
    user.id,
    body.deckId,
    graduatedCardsForRpc
  )

  if (!result.success) {
    logger.error(
      {
        userId: user.id,
        sessionId: body.sessionId,
        error: result.error.message
      },
      'Failed to complete learn session'
    )
    return NextResponse.json(
      { error: 'Failed to save progress' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    cardsGraduated: result.data.cardsGraduated
  })
}

export const POST = withErrorHandler(handler)
