import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { gradeCard, FsrsRating, FsrsCard } from '@/lib/study/fsrs'
import { getSession, addLog, updateCard } from '@/lib/study/sessionCache'
import { logger } from '@/lib/pipeline/logger'
import { rateRequestSchema } from '@/lib/study/schemas'
interface RateRequest {
  sessionId: string
  vocabularyId: string
  rating: FsrsRating
  card: FsrsCard
}
/**
 * POST /api/study/rate
 * Submits a card rating, updates session cache, and returns whether to re-add card.
 * Input: sessionId, vocabularyId, rating, current card state
 * Output: success, reAddCard flag, updated card state
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.error({ authError }, 'Authentication required')
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    let body: RateRequest
    try {
      body = await request.json()
    } catch (error) {
      logger.error({ userId: user.id, error }, 'Error parsing request body')
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const validationResult = rateRequestSchema.safeParse(body)
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

    const { sessionId, vocabularyId, rating, card } = validationResult.data

    // Get session from cache
    const session = await getSession(sessionId)
    if (!session) {
      logger.warn({ userId: user.id, sessionId, vocabularyId }, 'Session not found or expired')
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 404 }
      )
    }

    // Verify user owns session
    if (session.userId !== user.id) {
      logger.warn({ userId: user.id, sessionUserId: session.userId, sessionId, vocabularyId }, 'Unauthorized access attempt')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Apply FSRS algorithm to get updated card
    const gradedCard = gradeCard(card, rating)

    // Add review log and update card in session cache
    await addLog(sessionId, vocabularyId, gradedCard.log)
    await updateCard(sessionId, vocabularyId, gradedCard.card)

    // Determine if card should be re-added to session (based on due date)
    const reAddCard = gradedCard.card.due.getTime() < new Date().getTime() + 1000 * 60 * 30 // 30 minutes

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

    return NextResponse.json({
      success: true,
      reAddCard,
      card: gradedCard.card,
      nextReview: gradedCard.card.due.toISOString()
    })

  } catch (error) {
    logger.error({ error }, 'Error in /api/study/rate')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
