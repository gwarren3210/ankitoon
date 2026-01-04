import { logger } from '@/lib/logger'
import { DbClient } from '@/lib/study/types'

/**
 * Gets or creates a deck for a user and chapter.
 * Handles race conditions where multiple requests try to create the same deck.
 * Input: supabase client, user id, chapter id
 * Output: deck with id
 */
export async function getOrCreateDeck(
  supabase: DbClient,
  userId: string,
  chapterId: string
): Promise<{ id: string }> {
  logger.info({ userId, chapterId }, 'Getting or creating deck')
  
  const deck = await getDeck(supabase, userId, chapterId)
  if (deck) {
    logger.info({ userId, chapterId, deckId: deck.id }, 'Deck found, returning existing deck')
    return deck
  }
  
  logger.info({ userId, chapterId }, 'Deck not found, creating new deck')
  try {
    const newDeck = await createDeck(supabase, userId, chapterId)
    logger.info({ userId, chapterId, deckId: newDeck.id }, 'Deck created successfully')
    return newDeck
  } catch (error) {
    // Handle race condition: if another request created the deck,
    // retry getDeck
    if (error instanceof Error && error.message === 'DUPLICATE_DECK:23505') {
      logger.info({ userId, chapterId }, 'Deck created by concurrent request, retrying get')
      const existingDeck = await getDeck(supabase, userId, chapterId)
      if (existingDeck) {
        logger.info({ userId, chapterId, deckId: existingDeck.id }, 'Deck found after retry')
        return existingDeck
      }
      logger.error({ userId, chapterId }, 'Deck creation failed due to race condition and deck not found on retry')
      throw new Error('Deck creation failed due to race condition and deck not found on retry')
    }
    logger.error({ userId, chapterId, error }, 'Error in getOrCreateDeck')
    throw error
  }
}

/**
 * Gets an existing deck for a user and chapter.
 * Input: supabase client, user id, chapter id
 * Output: deck with id or null if not found
 */
async function getDeck(
  supabase: DbClient,
  userId: string,
  chapterId: string
): Promise<{ id: string } | null> {
  logger.debug({ userId, chapterId }, 'Fetching deck from database')
  const { data: deck, error: deckError } = await supabase
    .from('user_chapter_decks')
    .select('id')
    .eq('user_id', userId)
    .eq('chapter_id', chapterId)
    .single()

  if (deckError && deckError.code === 'PGRST116') {
    logger.debug({ userId, chapterId }, 'Deck not found (PGRST116 - no rows returned)')
    return null
  }

  if (deckError) {
    logger.error({ 
      userId, 
      chapterId, 
      error: deckError.message,
      code: deckError.code,
      details: deckError.details,
      hint: deckError.hint
    }, 'Error fetching deck')
    throw new Error(`Failed to fetch study deck: ${deckError.message}`)
  }

  if (deck) {
    logger.debug({ userId, chapterId, deckId: deck.id }, 'Deck fetched successfully')
  }

  return deck
}

/**
 * Creates a new deck for a user and chapter.
 * Input: supabase client, user id, chapter id
 * Output: deck with id
 */
async function createDeck(
  supabase: DbClient,
  userId: string,
  chapterId: string
): Promise<{ id: string }> {
  logger.debug({ userId, chapterId }, 'Fetching chapter data for deck name')
  const { data: chapterData, error: chapterError } = await supabase
    .from('chapters')
    .select('chapter_number')
    .eq('id', chapterId)
    .single()

  if (chapterError) {
    logger.error({ 
      userId, 
      chapterId, 
      error: chapterError.message,
      code: chapterError.code
    }, 'Error fetching chapter data for deck creation')
    throw new Error(`Failed to fetch chapter data: ${chapterError.message}`)
  }

  const deckName = `Chapter ${chapterData?.chapter_number || 'Unknown'}`
  logger.info({ userId, chapterId, deckName }, 'Creating new deck')

  const { data: newDeck, error: createError } = await supabase
    .from('user_chapter_decks')
    .insert({
      user_id: userId,
      chapter_id: chapterId,
      name: deckName
    })
    .select('id')
    .single()

  if (createError) {
    // If unique constraint violation, another request created it
    if (createError.code === '23505') {
      logger.info({ userId, chapterId }, 'Deck already exists (race condition - unique constraint violation)')
      throw new Error('DUPLICATE_DECK:23505')
    }
    logger.error({ 
      userId, 
      chapterId, 
      error: createError.message,
      code: createError.code,
      details: createError.details,
      hint: createError.hint
    }, 'Error creating deck')
    throw new Error(`Failed to create study deck: ${createError.message}`)
  }

  if (!newDeck) {
    logger.error({ userId, chapterId }, 'Deck insert succeeded but no deck data returned')
    throw new Error('Deck not found and could not be created')
  }

  logger.info({ userId, chapterId, deckId: newDeck.id, deckName }, 'Deck created successfully')
  return newDeck
}

