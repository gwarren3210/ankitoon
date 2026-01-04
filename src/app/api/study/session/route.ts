import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStudyCards } from '@/lib/study/cardRetrieval'
import {
  createSession,
  getSession,
  deleteSession,
} from '@/lib/study/sessionCache'
import { createStudySession } from '@/lib/study/sessions'
import { updateChapterProgress, updateSeriesProgress } from '@/lib/study/progress'
import { persistSessionReviews, ReviewLogEntry } from '@/lib/study/batchCardUpdates'
import { initializeChapterCards } from '@/lib/study/initialization'
import { getOrCreateDeck } from '@/lib/study/deckManagement'
import { logger } from '@/lib/logger'
import { FsrsState } from '@/lib/study/fsrs'
import { sessionRequestSchema } from '@/lib/study/schemas'
import { Card } from 'ts-fsrs'

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

async function handleStartSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  chapterId: string
) {
  logger.info({ userId, chapterId }, 'Starting session for chapter')
  
  // Check if chapter exists
  const { data: chapter, error: chapterError } = await supabase
    .from('chapters')
    .select('id, series_id')
    .eq('id', chapterId)
    .single()

  if (chapterError || !chapter) {
    logger.warn({ userId, chapterId, error: chapterError?.message, code: chapterError?.code }, 'Chapter not found')
    return NextResponse.json(
      { error: 'Chapter not found' },
      { status: 404 }
    )
  }

  // Get or create deck
  let deck
  try {
    deck = await getOrCreateDeck(supabase, userId, chapterId)
  } catch (error) {
    logger.error({ userId, chapterId, error }, 'Error getting or creating deck')
    return NextResponse.json(
      { error: 'Failed to get or create study deck' },
      { status: 500 }
    )
  }

  // Check if this is first time studying chapter (no cards exist)
  logger.debug({ userId, chapterId, deckId: deck.id }, 'Checking existing cards count')
  const { count: existingCardsCount, error: countError } = await supabase
    .from('user_deck_srs_cards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('deck_id', deck.id)

  if (countError) {
    logger.error({ userId, chapterId, deckId: deck.id, error: countError }, 'Error checking existing cards')
    return NextResponse.json(
      { error: 'Failed to check existing cards' },
      { status: 500 }
    )
  }

    // check total cards for this chapter
  const { count: totalCardsCount, error: totalCardsError } = await supabase
    .from('chapter_vocabulary')
    .select('id', { count: 'exact', head: true })
    .eq('chapter_id', chapterId)

  if (totalCardsError) {
    logger.error({ userId, chapterId, error: totalCardsError.message, code: totalCardsError.code }, 'Error checking total cards')
    return NextResponse.json(
      { error: 'Failed to check total cards' },
      { status: 500 }
    )
  }

  logger.debug({ userId, chapterId, totalCardsCount }, 'Total vocabulary count retrieved')

  if (!totalCardsCount) {
    logger.warn({ userId, chapterId, deckId: deck.id }, 'Chapter has no vocabulary cards')
    return NextResponse.json(
      { error: 'Chapter has no cards' },
      { status: 404 }
    )
  }

  // Initialize all cards if first time studying chapter
  if (!existingCardsCount || existingCardsCount < totalCardsCount) {
    const cardsToInitialize = totalCardsCount - (existingCardsCount || 0)
    logger.info({
      userId,
      chapterId,
      deckId: deck.id,
      existingCardsCount,
      totalCardsCount,
      cardsToInitialize
    }, 'Initializing cards for first-time chapter study')
    
    try {
      const initializedCount = await initializeChapterCards(supabase, userId, deck.id, chapterId)
      logger.info({
        userId,
        chapterId,
        deckId: deck.id,
        initializedCount,
        expectedCount: cardsToInitialize
      }, 'Cards initialized successfully')
    } catch (error) {
      logger.error({
        userId,
        chapterId,
        deckId: deck.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }, 'Error initializing chapter cards')
      return NextResponse.json(
        { error: 'Failed to initialize study cards' },
        { status: 500 }
      )
    }
  } else {
    logger.debug({
      userId,
      chapterId,
      deckId: deck.id,
      existingCardsCount,
      totalCardsCount
    }, 'All cards already initialized, skipping initialization')
  }

  // Get study cards (settings fetched from profile inside RPC)
  let cards: Awaited<ReturnType<typeof getStudyCards>>
  try {
    logger.info('Fetching study cards for chapter %s, user %s', chapterId, userId)
    cards = await getStudyCards(
      supabase,
      userId,
      chapterId
    )
    logger.info('Fetched %d study cards', cards.length)
  } catch (error) {
    logger.error({ error }, 'Error fetching study cards')
  
    return NextResponse.json(
      { 
        error: 'Failed to fetch study cards',
        details: process.env.NODE_ENV === 'development' 
          ? error instanceof Error ? error.message : String(error)
          : undefined
      },
      { status: 500 }
    )
  }

  // Create session in cache
  // check if the session already exists
  // if it does, return the session
  try {
    logger.debug({ userId, chapterId, deckId: deck.id, cardCount: cards.length }, 'Checking for existing session in cache')
    let session = await getSession(deck.id)
    
    if (session && session.expiresAt >= new Date()) {
      logger.info({
        userId,
        chapterId,
        deckId: deck.id,
        sessionId: deck.id,
        expiresAt: session.expiresAt.toISOString(),
        cardCount: session.cards.size
      }, 'Reusing existing valid session from cache')
    } else {
      if (session) {
        logger.debug({
          userId,
          chapterId,
          deckId: deck.id,
          expiresAt: session.expiresAt.toISOString()
        }, 'Existing session expired, creating new session')
      } else {
        logger.debug({ userId, chapterId, deckId: deck.id }, 'No existing session found, creating new session')
      }
      
      logger.info({
        userId,
        chapterId,
        deckId: deck.id,
        cardCount: cards.length
      }, 'Creating new session in cache')
      
      await createSession(userId, chapterId, deck.id, cards)
      session = await getSession(deck.id)
    }

    if (!session) {
      logger.error({
        userId,
        chapterId,
        deckId: deck.id
      }, 'Failed to create session - session is null after creation')
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      )
    }

    // Convert Map to array of StudyCard objects
    const cardsArray = Array.from(session.cards.entries()).map(([vocabularyId, srsCard]) => {
      const vocabulary = session.vocabulary.get(vocabularyId)
      if (!vocabulary) {
        logger.error('Vocabulary not found for id: %s', vocabularyId)
        throw new Error(`Vocabulary not found for id: ${vocabularyId}`)
      }
      const srsCardId = session.srsCardIds.get(vocabularyId)
      if (!srsCardId) {
        logger.error('SRS card ID not found for vocabulary: %s', vocabularyId)
        throw new Error(`SRS card ID not found for vocabulary: ${vocabularyId}`)
      }
      return {
        srsCard,
        vocabulary,
        srsCardId
      }
    })
    
    const numNewCards = cardsArray.filter(card => card.srsCard.state === FsrsState.New).length
    logger.info({
      userId,
      chapterId,
      deckId: deck.id,
      sessionId: deck.id,
      cardCount: cardsArray.length,
      numNewCards,
      startTime: session.createdAt
    }, 'Session started successfully')

    return NextResponse.json({
      sessionId: deck.id,
      deckId: deck.id,
      cards: cardsArray,
      numNewCards,
      numCards: cards.length,
      startTime: session.createdAt
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    logger.error('Error creating session or converting cards: %s', errorMessage)
    if (errorStack) {
      logger.error('Error stack: %s', errorStack)
    }
    return NextResponse.json(
      { 
        error: 'Failed to create session',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}

async function handleEndSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sessionId: string
) {
  logger.info({ userId, sessionId }, 'Ending study session')
  
  try {
    const session = await getSession(sessionId)
    if (!session) {
      logger.warn({ userId, sessionId }, 'Session not found or expired')
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 404 }
      )
    }

    if (session.userId !== userId) {
      logger.warn({ userId, sessionUserId: session.userId, sessionId }, 'Unauthorized access attempt to session')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    logger.debug({
      userId,
      sessionId,
      chapterId: session.chapterId,
      deckId: session.deckId,
      vocabularyCount: session.vocabulary.size,
      cardsCount: session.cards.size,
      logsCount: Array.from(session.logs.values()).reduce((sum, logs) => sum + logs.length, 0)
    }, 'Session retrieved, collecting cards and logs for batch processing')

    // Collect all cards and logs for batch processing
    const cardsToUpdate = new Map<string, Card>()
    const logsToPersist: ReviewLogEntry[] = []
    let totalLogs = 0
    let logsWithGoodRating = 0

    for (const [vocabularyId, logs] of session.logs.entries()) {
      if (logs.length === 0) continue

      const finalCard = session.cards.get(vocabularyId)
      if (!finalCard) continue

      cardsToUpdate.set(vocabularyId, finalCard)

      const srsCardId = session.srsCardIds.get(vocabularyId)
      if (!srsCardId) {
        logger.error({ userId, vocabularyId, deckId: session.deckId }, 'Missing srsCardId for vocabulary in session cache')
        throw new Error(`Missing srsCardId for vocabulary in session cache: ${vocabularyId}`)
      }
      for (const log of logs) {
        logsToPersist.push({
          vocabularyId,
          log,
          srsCardId
        })
        totalLogs++
        if (log.rating >= 3) {
          logsWithGoodRating++
        }
      }
    }

    logger.info({
      userId,
      sessionId,
      deckId: session.deckId,
      cardsToUpdate: cardsToUpdate.size,
      logsToPersist: logsToPersist.length,
      totalLogs
    }, 'Persisting session reviews to database')

    // Persist cards and logs using RPC transaction
    try {
      await persistSessionReviews(
        supabase,
        userId,
        session.deckId,
        cardsToUpdate,
        logsToPersist
      )
      logger.debug({
        userId,
        sessionId,
        deckId: session.deckId,
        cardsUpdated: cardsToUpdate.size,
        logsPersisted: logsToPersist.length
      }, 'Session reviews persisted successfully')
    } catch (error) {
      logger.error({
        userId,
        deckId: session.deckId,
        cardsCount: cardsToUpdate.size,
        logsCount: logsToPersist.length,
        error
      }, 'Error persisting session reviews')
      throw error
    }

    // Calculate session stats
    const cardsStudied = totalLogs
    const accuracy = cardsStudied > 0
      ? (logsWithGoodRating / cardsStudied) * 100
      : 0
    const timeSpentSeconds = Math.floor(
      (new Date().getTime() - session.createdAt.getTime()) / 1000
    )

    // Get chapter series_id
    let chapter
    try {
      const { data: chapterData, error: chapterError } = await supabase
        .from('chapters')
        .select('series_id')
        .eq('id', session.chapterId)
        .single()

      if (chapterError) {
        logger.error({ userId, chapterId: session.chapterId, error: chapterError.message, code: chapterError.code }, 'Error fetching chapter data')
        throw chapterError
      }
      chapter = chapterData
    } catch (error) {
      logger.error({ userId, chapterId: session.chapterId, error }, 'Error getting chapter series_id')
      throw error
    }

    if (chapter) {
      logger.debug({
        userId,
        sessionId,
        chapterId: session.chapterId,
        seriesId: chapter.series_id,
        cardsStudied,
        accuracy,
        timeSpentSeconds
      }, 'Creating study session record and updating progress')

      // Run createStudySession and updateChapterProgress in parallel
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [_, __] = await Promise.all([
          createStudySession(supabase, userId, session.chapterId, {
            deckId: session.deckId,
            cardsStudied,
            accuracy: accuracy / 100,
            timeSpentSeconds,
            startTime: session.createdAt,
            endTime: new Date()
          }).catch(error => {
            logger.error({ userId, chapterId: session.chapterId, error }, 'Error creating study session')
            throw error
          }),
          updateChapterProgress(
            supabase,
            userId,
            session.chapterId,
            chapter.series_id,
            session.deckId,
            accuracy / 100,
            timeSpentSeconds,
            session.cards
          ).catch(error => {
            logger.error({ userId, chapterId: session.chapterId, error }, 'Error updating chapter progress')
            throw error
          })
        ])
      } catch (error) {
        logger.error({ userId, chapterId: session.chapterId, error }, 'Error in parallel session/progress operations')
        throw error
      }

      logger.debug({
        userId,
        sessionId,
        chapterId: session.chapterId,
        seriesId: chapter.series_id
      }, 'Updating series progress after chapter progress update')

      // Update series progress after chapter progress
      try {
        await updateSeriesProgress(
          supabase,
          userId,
          chapter.series_id
        )
        logger.debug({
          userId,
          sessionId,
          seriesId: chapter.series_id
        }, 'Series progress updated successfully')
      } catch (error) {
        logger.error({
          userId,
          sessionId,
          seriesId: chapter.series_id,
          error
        }, 'Error updating series progress')
        // Don't throw - series progress update failure shouldn't fail the whole operation
      }
    } else {
      logger.warn({
        userId,
        sessionId,
        chapterId: session.chapterId
      }, 'Chapter not found, skipping progress updates')
    }

    // Delete session from cache (even if persistence failed)
    logger.debug({ userId, sessionId }, 'Deleting session from cache')
    try {
      await deleteSession(sessionId)
      logger.debug({ userId, sessionId }, 'Session deleted from cache successfully')
    } catch (deleteError) {
      logger.error({ sessionId, userId, error: deleteError }, 'Failed to delete session from cache after ending session')
      // Continue - session deletion failure shouldn't fail the whole operation
    }

    logger.info({
      userId,
      sessionId,
      chapterId: session.chapterId,
      cardsStudied,
      accuracy,
      timeSpentSeconds,
      startTime: session.createdAt,
      endTime: new Date()
    }, 'Session ended successfully')

    return NextResponse.json({
      success: true,
      cardsStudied,
      accuracy,
      timeSpentSeconds
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    logger.error(
      { sessionId, userId, error: errorMessage, stack: errorStack },
      'Error ending session'
    )
    throw error // Re-throw to be caught by POST handler
  }
}
