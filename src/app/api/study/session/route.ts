import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStudyCards } from '@/lib/study/studyData'
import {
  createSession,
  getSession,
  deleteSession,
} from '@/lib/study/sessionCache'
import {
  createStudySession,
  updateChapterProgress,
  updateSrsCard,
  logReview,
  initializeChapterCards
} from '@/lib/study/studyData'
import { logger } from '@/lib/pipeline/logger'
import { FsrsState } from '@/lib/study/fsrs'

interface StartSessionRequest {
  chapterId: string
}

interface EndSessionRequest {
  sessionId: string
}
const DEFAULT_MAX_NEW_CARDS = 5
const DEFAULT_MAX_TOTAL_CARDS = 20
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
      logger.error('Authentication required: %s', authError)
      return NextResponse.json(
        { error: 'Authentication required' },
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

    // Determine if this is start or end request
    if ('sessionId' in body) {
      return await handleEndSession(supabase, user.id, body.sessionId)
    } else if ('chapterId' in body) {
      return await handleStartSession(supabase, user.id, body.chapterId)
    } else {
      return NextResponse.json(
        { error: 'Missing required field: chapterId or sessionId' },
        { status: 400 }
      )
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    const errorDetails = error instanceof Error ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error)
    
    logger.error('Error in /api/study/session: %s', errorMessage)
    if (errorStack) {
      logger.error('Error stack: %s', errorStack)
    }
    logger.error('Error details: %s', errorDetails)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}

// TODO: consider params for max total cards, alternatively we can have it as a setting in the profile or create a new table for user settings
async function handleStartSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  chapterId: string
) {
  // Check if chapter exists
  const { data: chapter, error: chapterError } = await supabase
    .from('chapters')
    .select('id, series_id')
    .eq('id', chapterId)
    .single()

  if (chapterError || !chapter) {
    return NextResponse.json(
      { error: 'Chapter not found' },
      { status: 404 }
    )
  }

  // Get or create deck
  let { data: deck, error: deckError } = await supabase
    .from('user_chapter_decks')
    .select('id')
    .eq('user_id', userId)
    .eq('chapter_id', chapterId)
    .single()

  if (deckError && deckError.code === 'PGRST116') {
    const { data: chapterData } = await supabase
      .from('chapters')
      .select('chapter_number')
      .eq('id', chapterId)
      .single()

    const { data: newDeck, error: createError } = await supabase
      .from('user_chapter_decks')
      .insert({
        user_id: userId,
        chapter_id: chapterId,
        // maybe we should use series title and chapter number instead of just chapter number
        name: `Chapter ${chapterData?.chapter_number || 'Unknown'}`
      })
      .select('id')
      .single()

    if (createError) {
      logger.error('Error creating deck: %s', createError)
      return NextResponse.json(
        { error: 'Failed to create study deck' },
        { status: 500 }
      )
    }
    deck = newDeck
  } else if (deckError) {
    logger.error('Error fetching deck: %s', deckError)
    return NextResponse.json(
      { error: 'Failed to fetch study deck' },
      { status: 500 }
    )
  }

  if (!deck) {
    return NextResponse.json(
      { error: 'Deck not found and could not be created' },
      { status: 500 }
    )
  }

  // Check if this is first time studying chapter (no cards exist)
  const { count: existingCardsCount, error: countError } = await supabase
    .from('user_deck_srs_cards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('deck_id', deck.id)

  if (countError) {
    logger.error('Error checking existing cards: %s', countError)
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
    logger.error('Error checking total cards: %s', totalCardsError)
    return NextResponse.json(
      { error: 'Failed to check total cards' },
      { status: 500 }
    )
  }
  if (!totalCardsCount) {
    return NextResponse.json(
      { error: 'Chapter has no cards' },
      { status: 404 }
    )
  }

  // Initialize all cards if first time studying chapter
  if (!existingCardsCount || existingCardsCount < totalCardsCount) {
    try {
      await initializeChapterCards(supabase, userId, deck.id, chapterId)
      logger.info('Initialized cards for chapter %s, user %s', chapterId, userId)
    } catch (error) {
      logger.error('Error initializing chapter cards: %s', error instanceof Error ? error.message : String(error))
      if (error instanceof Error) {
        logger.error('Error stack: %s', error.stack)
      }
      return NextResponse.json(
        { error: 'Failed to initialize study cards' },
        { status: 500 }
      )
    }
  }

  // Get study cards
  let cards: Awaited<ReturnType<typeof getStudyCards>>
  try {
    logger.info('Fetching study cards for chapter %s, user %s', chapterId, userId)
    cards = await getStudyCards(
      supabase,
      userId,
      chapterId,
      DEFAULT_MAX_NEW_CARDS,
      DEFAULT_MAX_TOTAL_CARDS
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
    logger.info('Creating session for deck %s', deck.id)
    let session = getSession(deck.id)
    if (!session || session.expiresAt < new Date()) { 
      createSession(userId, chapterId, deck.id, cards)
      session = getSession(deck.id)
    }

    if (!session) {
      logger.error('Failed to create session - session is null after creation')
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
      return {
        srsCard,
        vocabulary
      }
    })
    
    logger.info('Session created successfully with %d cards', cardsArray.length)

    return NextResponse.json({
      sessionId: deck.id,
      deckId: deck.id,
      cards: cardsArray,
      numNewCards: cardsArray.filter(card => card.srsCard.state === FsrsState.New).length,
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
  const session = getSession(sessionId)
  if (!session) {
    return NextResponse.json(
      { error: 'Session not found or expired' },
      { status: 404 }
    )
  }

  if (session.userId !== userId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 403 }
    )
  }

  // Persist all logs and updated cards
  // TODO: consider using a transaction to persist the logs and updated cards
  // TODO: consider using a batch update for the updated cards
  let totalLogs = 0
  let logsWithGoodRating = 0

  for (const [vocabularyId, logs] of session.logs.entries()) {
    if (logs.length === 0) continue

    // Get the final card state after all reviews
    const finalCard = session.cards.get(vocabularyId)
    if (!finalCard) continue

    // Get srs_card_id if it exists
    const { data: existingCard } = await supabase
      .from('user_deck_srs_cards')
      .select('id')
      .eq('user_id', userId)
      .eq('deck_id', session.deckId)
      .eq('vocabulary_id', vocabularyId)
      .single()

    // Update card with final state
    await updateSrsCard(
      supabase,
      userId,
      session.deckId,
      vocabularyId,
      finalCard
    )

    // Log each review for this vocabulary item
    for (const log of logs) {
      await logReview(
        supabase,
        userId,
        vocabularyId,
        finalCard,
        existingCard?.id
      )
      totalLogs++
      if (log.rating >= 3) {
        logsWithGoodRating++
      }
    }
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
  const { data: chapter } = await supabase
    .from('chapters')
    .select('series_id')
    .eq('id', session.chapterId)
    .single()

  if (chapter) {
    await createStudySession(supabase, userId, session.chapterId, {
      cardsStudied,
      accuracy: accuracy / 100,
      timeSpentSeconds,
      startTime: session.createdAt,
      endTime: new Date()
    })

    await updateChapterProgress(
      supabase,
      userId,
      session.chapterId,
      chapter.series_id,
      cardsStudied,
      accuracy / 100,
      timeSpentSeconds
    )
  }

  // Delete session from cache
  deleteSession(sessionId)

  return NextResponse.json({
    success: true,
    cardsStudied,
    accuracy,
    timeSpentSeconds
  })
}
