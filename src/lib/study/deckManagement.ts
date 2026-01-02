import { logger } from '@/lib/logger'
import { DbClient } from './types'

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
  logger.debug({ userId, chapterId }, 'Getting or creating deck')
  
  const deck = await getDeck(supabase, userId, chapterId)
  if (deck) {
    logger.debug({ userId, chapterId, deckId: deck.id }, 'Deck found')
    return deck
  }
  
  try {
    const newDeck = await createDeck(supabase, userId, chapterId)
    logger.info({ userId, chapterId, deckId: newDeck.id }, 'Deck created')
    return newDeck
  } catch (error) {
    // Handle race condition: if another request created the deck,
    // retry getDeck
    if (error instanceof Error && error.message === 'DUPLICATE_DECK:23505') {
      logger.debug({ userId, chapterId }, 'Deck created by concurrent request, retrying get')
      const existingDeck = await getDeck(supabase, userId, chapterId)
      if (existingDeck) {
        logger.debug({ userId, chapterId, deckId: existingDeck.id }, 'Deck found after retry')
        return existingDeck
      }
      throw new Error('Deck creation failed due to race condition and deck not found on retry')
    }
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
  const { data: deck, error: deckError } = await supabase
    .from('user_chapter_decks')
    .select('id')
    .eq('user_id', userId)
    .eq('chapter_id', chapterId)
    .single()

  if (deckError && deckError.code === 'PGRST116') {
    return null
  }

  if (deckError) {
    logger.error({ userId, chapterId, deckError }, 'Error fetching deck')
    throw new Error(`Failed to fetch study deck: ${deckError.message}`)
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
      name: `Chapter ${chapterData?.chapter_number || 'Unknown'}`
    })
    .select('id')
    .single()

  if (createError) {
    // If unique constraint violation, another request created it
    if (createError.code === '23505') {
      logger.debug({ userId, chapterId }, 'Deck already exists (race condition)')
      throw new Error('DUPLICATE_DECK:23505')
    }
    logger.error({ userId, chapterId, createError }, 'Error creating deck')
    throw new Error(`Failed to create study deck: ${createError.message}`)
  }

  if (!newDeck) {
    throw new Error('Deck not found and could not be created')
  }

  return newDeck
}

