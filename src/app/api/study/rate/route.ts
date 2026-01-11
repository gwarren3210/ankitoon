import { NextRequest } from 'next/server'
import { gradeCard } from '@/lib/study/fsrs'
import { getSession, addLog, updateCard } from '@/lib/study/sessionCache'
import { logger } from '@/lib/logger'
import { rateRequestSchema } from '@/lib/study/schemas'
import {
  withErrorHandler,
  requireAuth,
  parseAndValidate,
  requireOwnership,
  successResponse,
  SessionNotFoundError
} from '@/lib/api'

/**
 * POST /api/study/rate
 * Submits a card rating, updates session cache, and returns whether to re-add.
 * Input: sessionId, vocabularyId, rating, current card state
 * Output: success, reAddCard flag, updated card state
 */
async function handler(request: NextRequest) {
  const { user } = await requireAuth()
  const { sessionId, vocabularyId, rating, card } = await parseAndValidate(
    request,
    rateRequestSchema
  )

  // Get session from cache
  const session = await getSession(sessionId)
  if (!session) {
    throw new SessionNotFoundError()
  }

  // Verify user owns session
  requireOwnership(session.userId, user.id, 'session')

  // Apply FSRS algorithm to get updated card
  const gradedCard = gradeCard(card, rating)

  // Add review log and update card in session cache
  await addLog(sessionId, vocabularyId, gradedCard.log)
  await updateCard(sessionId, vocabularyId, gradedCard.card)

  // Determine if card should be re-added to session (due within 30 minutes)
  const thirtyMinutesFromNow = new Date().getTime() + 1000 * 60 * 30
  const reAddCard = gradedCard.card.due.getTime() < thirtyMinutesFromNow

  logger.info({
    userId: user.id,
    sessionId,
    vocabularyId,
    rating,
    reAddCard,
    newStability: gradedCard.card.stability,
    newDifficulty: gradedCard.card.difficulty,
    nextReview: gradedCard.card.due.toISOString()
  }, 'Card rated successfully')

  return successResponse({
    success: true,
    reAddCard,
    card: gradedCard.card,
    nextReview: gradedCard.card.due.toISOString()
  })
}

export const POST = withErrorHandler(handler)
