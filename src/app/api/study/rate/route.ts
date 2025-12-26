import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { gradeCard } from '@/lib/study/fsrs'
import { Card as SrsCard, Rating } from 'ts-fsrs'
import { getSession, addLog, updateCard } from '@/lib/study/sessionCache'
import { logger } from '@/lib/pipeline/logger'

interface RateRequest {
  sessionId: string
  vocabularyId: string
  rating: Rating
  card: SrsCard
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
      logger.error('Authentication required: %s', authError)
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    let body: RateRequest
    try {
      body = await request.json()
    } catch (error) {
      logger.error('Error parsing request body: %s', error)
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { sessionId, vocabularyId, rating, card } = body

    if (!sessionId || !vocabularyId || !rating || !card) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, vocabularyId, rating, card' },
        { status: 400 }
      )
    }

    // Validate rating
    if (![1, 2, 3, 4].includes(rating)) {
      return NextResponse.json(
        { error: 'Invalid rating. Must be 1-4' },
        { status: 400 }
      )
    }

    // Validate card structure
    // TODO: validate card structure using zod
    if (!vocabularyId || !card.due || typeof card.stability !== 'number' || 
        typeof card.difficulty !== 'number') {
      return NextResponse.json(
        { error: 'Invalid card structure' },
        { status: 400 }
      )
    }

    // Get session from cache
    const session = getSession(sessionId)
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 404 }
      )
    }

    // Verify user owns session
    if (session.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Apply FSRS algorithm to get updated card
    // IMPORTANT TODO: use the actual FSRS package to update the card, not this custom implementation
    const gradedCard = gradeCard(card, rating)

    // Add review log and update card in session cache
    addLog(sessionId, vocabularyId, gradedCard.log)
    updateCard(sessionId, vocabularyId, gradedCard.card)

    // Determine if card should be re-added to session (based on due date)
    const reAddCard = gradedCard.card.due.getTime() < new Date().getTime() + 1000 * 60 * 30 // 30 minutes

    return NextResponse.json({
      success: true,
      reAddCard,
      card: gradedCard.card,
      nextReview: gradedCard.card.due.toISOString()
    })

  } catch (error) {
    logger.error('Error in /api/study/rate: %s', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
