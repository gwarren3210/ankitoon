import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStudyCards } from '@/lib/study/cardRetrieval'
import {
  createSession,
  getSession,
} from '@/lib/study/sessionCache'
import { initializeChapterCards } from '@/lib/study/initialization'
import { getOrCreateDeck } from '@/lib/study/deckManagement'
import { logger } from '@/lib/logger'
import { FsrsState } from '@/lib/study/fsrs'

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

