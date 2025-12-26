import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Tables, TablesInsert, TablesUpdate } from '@/types/database.types'
import { createNewCard } from './fsrs'
import { Card, State } from 'ts-fsrs'
import { logger } from '@/lib/pipeline/logger'

type DbClient = SupabaseClient<Database>

// TODO: decide if we want combine types for more readable code or keep them separate
export interface StudyCard {
  srsCard: Card
  vocabulary: Tables<'vocabulary'>
}

export interface StudySessionData {
  cardsStudied: number
  accuracy: number
  timeSpentSeconds: number
  startTime: Date
  endTime: Date
}

/**
 * Gets SRS cards for a chapter that are due for review.
 * Input: supabase client, user id, chapter id, limit
 * Output: Array of SRS cards due for review
 */
export async function getDueCards(
  supabase: DbClient,
  userId: string,
  chapterId: string,
  limit: number = 50
): Promise<StudyCard[]> {
  const now = new Date().toISOString()
  // TODO: examine query if this is the best way to get the data
  // TODO: use strict typing for the data
  // TODO: create migration file to ensure strict typing is enforced
  // TODO: no need to cast to any
  // First get deck IDs for this chapter
  logger.debug({ userId, chapterId, limit }, 'Getting due cards')
  const { data: decks, error: deckError } = await supabase
    .from('user_chapter_decks')
    .select('id')
    .eq('user_id', userId)
    .eq('chapter_id', chapterId)

  if (deckError) {
    logger.error({ userId, chapterId, error: deckError.message, code: deckError.code }, 'Error fetching decks for due cards')
    throw deckError
  }

  if (!decks || decks.length === 0) {
    logger.debug({ userId, chapterId }, 'No decks found for chapter')
    return []
  }

  const deckIds = decks.map(d => d.id)

  // Get due cards for these decks
  const { data, error } = await supabase
    .from('user_deck_srs_cards')
    .select(`
      id,
      vocabulary_id,
      state,
      stability,
      difficulty,
      streak_correct,
      streak_incorrect,
      total_reviews,
      next_review_date,
      last_reviewed_date,
      first_seen_date,
      vocabulary (
        id,
        term,
        definition,
        example,
        sense_key
      )
    `)
    .eq('user_id', userId)
    // TODO: why not just join through user_chapter_decks? also pretty sure `deck_id` is not the name of any column in th db
    .in('deck_id', deckIds)
    .lte('next_review_date', now)
    .order('next_review_date', { ascending: true })
    .limit(limit)

  if (error) {
    logger.error({ userId, chapterId, deckIds, error: error.message, code: error.code }, 'Error fetching due cards')
    throw error
  }

  if (!data) {
    logger.warn({ userId, chapterId }, 'No due cards found')
    return []
  }

  logger.info({ userId, chapterId, cardCount: data.length }, 'Retrieved due cards')

  return data.map(card => {
    const vocabulary = card.vocabulary as Tables<'vocabulary'>
    if (!vocabulary) {
      throw new Error(`Vocabulary not found for card ${card.id}`)
    }

    // Convert database state string to FSRS State enum
    const stateMap: Record<string, State> = {
      'New': State.New,
      'Learning': State.Learning,
      'Review': State.Review,
      'Relearning': State.Relearning
    }
    const fsrsState = stateMap[card.state] || State.New

    // Calculate elapsed days
    const now = new Date()
    const lastReview = card.last_reviewed_date ? new Date(card.last_reviewed_date) : null
    const elapsedDays = lastReview 
      ? Math.floor((now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24))
      : 0

    const fsrsCard: Card = {
      due: new Date(card.next_review_date || new Date()),
      stability: card.stability || 0,
      difficulty: card.difficulty || 2.5,
      elapsed_days: elapsedDays,
      scheduled_days: card.stability || 0,
      learning_steps: 0,
      reps: card.total_reviews || 0,
      lapses: card.streak_incorrect || 0,
      state: fsrsState,
      last_review: lastReview || undefined
    }

    return {
      srsCard: fsrsCard,
      vocabulary
    }
  })
}

/**
 * Gets new vocabulary cards for a chapter (never studied by user).
 * Input: supabase client, user id, chapter id, limit
 * Output: Array of new vocabulary cards
 */
export async function getNewCards(
  supabase: DbClient,
  userId: string,
  chapterId: string,
  limit: number = 20
): Promise<StudyCard[]> {
  // TODO: consider using an rpc function to get all the data at once

  // Get deck IDs for this chapter first
  logger.debug({ userId, chapterId, limit }, 'Getting new cards')
  const { data: decks, error: deckError } = await supabase
    .from('user_chapter_decks')
    .select('id')
    .eq('user_id', userId)
    .eq('chapter_id', chapterId)

  if (deckError) {
    logger.error({ userId, chapterId, error: deckError.message, code: deckError.code }, 'Error fetching decks for new cards')
    throw deckError
  }

  const deckIds = decks?.map(d => d.id) || []
  
  // Get vocabulary IDs that user has already studied in these decks
  const { data: studiedCards, error: studiedError } = await supabase
    .from('user_deck_srs_cards')
    .select('vocabulary_id')
    .eq('user_id', userId)
    .in('deck_id', deckIds)

  if (studiedError) {
    logger.error({ userId, chapterId, error: studiedError.message, code: studiedError.code }, 'Error fetching studied cards')
    throw studiedError
  }

  const studiedVocabularyIds = new Set(
    (studiedCards || []).map(card => card.vocabulary_id)
  )

  // Get all vocabulary for this chapter
  const { data: chapterVocab, error: vocabError } = await supabase
    .from('chapter_vocabulary')
    .select(`
      vocabulary_id,
      vocabulary (
        id,
        term,
        definition,
        example,
        sense_key
      )
    `)
    .eq('chapter_id', chapterId)

  if (vocabError) {
    logger.error({ userId, chapterId, error: vocabError.message, code: vocabError.code }, 'Error fetching chapter vocabulary')
    throw vocabError
  }

  if (!chapterVocab) {
    logger.warn({ userId, chapterId }, 'No chapter vocabulary found')
    return []
  }

  // Filter out already studied vocabulary and limit results
  const newVocab = chapterVocab
    .filter(item => !studiedVocabularyIds.has(item.vocabulary_id))
    .slice(0, limit)
    .map(item => {
      const vocabulary = item.vocabulary as Tables<'vocabulary'>
      if (!vocabulary) {
        throw new Error(`Vocabulary not found for id ${item.vocabulary_id}`)
      }

      return {
        srsCard: createNewCard(),
        vocabulary
      }
    })

  logger.info({ userId, chapterId, newCardCount: newVocab.length }, 'Retrieved new cards')
  return newVocab
}

/**
 * Creates or updates an SRS card after a review.
 * Input: supabase client, user id, deck id, updated card
 * Output: void
 */
export async function updateSrsCard(
  supabase: DbClient,
  userId: string,
  deckId: string,
  vocabularyId: string,
  card: Card
): Promise<void> {
  // Convert FSRS State enum to database string enum
  const stateMap: Record<State, string> = {
    [State.New]: 'New',
    [State.Learning]: 'Learning',
    [State.Review]: 'Review',
    [State.Relearning]: 'Relearning'
  }

  const cardData: TablesUpdate<'user_deck_srs_cards'> = {
    state: stateMap[card.state] as Database['public']['Enums']['srs_state'],
    stability: card.stability,
    difficulty: card.difficulty,
    total_reviews: card.reps,
    streak_incorrect: card.lapses,
    next_review_date: card.due.toISOString(),
    last_reviewed_date: card.last_review?.toISOString() || null
  }

  const insertData: TablesInsert<'user_deck_srs_cards'> = {
    deck_id: deckId,
    vocabulary_id: vocabularyId,
    user_id: userId,
    state: cardData.state as Database['public']['Enums']['srs_state'],
    stability: card.stability,
    difficulty: card.difficulty,
    total_reviews: card.reps,
    streak_incorrect: card.lapses,
    next_review_date: card.due.toISOString(),
    last_reviewed_date: card.last_review?.toISOString() || null
  }

  // Use upsert to handle both create and update
  logger.debug({ userId, deckId, vocabularyId, state: card.state, stability: card.stability, difficulty: card.difficulty }, 'Updating SRS card')
  const { error } = await supabase
    .from('user_deck_srs_cards')
    .upsert(insertData, {
      onConflict: 'deck_id,vocabulary_id,user_id'
    })

  if (error) {
    logger.error({ userId, deckId, vocabularyId, error: error.message, code: error.code }, 'Error updating SRS card')
    throw error
  }
  logger.debug({ userId, deckId, vocabularyId }, 'SRS card updated successfully')
}

/**
 * Logs a review to the SRS progress logs table.
 * Input: supabase client, user id, vocabulary id, card after review, srs card id
 * Output: void
 */
export async function logReview(
  supabase: DbClient,
  userId: string,
  vocabularyId: string,
  card: Card,
  srsCardId?: string
): Promise<void> {
  // Convert FSRS State enum to database string enum
  const stateMap: Record<State, string> = {
    [State.New]: 'New',
    [State.Learning]: 'Learning',
    [State.Review]: 'Review',
    [State.Relearning]: 'Relearning'
  }

  const logData: TablesInsert<'srs_progress_logs'> = {
    user_id: userId,
    vocabulary_id: vocabularyId,
    srs_card_id: srsCardId || null,
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: stateMap[card.state] as Database['public']['Enums']['srs_state'],
    last_review: card.last_review?.toISOString() || null
  }

  logger.debug({ userId, vocabularyId, srsCardId, state: card.state, reps: card.reps }, 'Logging review')
  const { error } = await supabase
    .from('srs_progress_logs')
    .insert(logData)

  if (error) {
    logger.error({ userId, vocabularyId, srsCardId, error: error.message, code: error.code }, 'Error logging review')
    throw error
  }
  logger.debug({ userId, vocabularyId }, 'Review logged successfully')
}

/**
 * Creates a study session record.
 * Input: supabase client, user id, chapter id, session data
 * Output: void
 */
export async function createStudySession(
  supabase: DbClient,
  userId: string,
  chapterId: string,
  sessionData: StudySessionData
): Promise<void> {
  const sessionRecord: TablesInsert<'user_chapter_study_sessions'> = {
    user_id: userId,
    chapter_id: chapterId,
    cards_studied: sessionData.cardsStudied,
    accuracy: sessionData.accuracy,
    time_spent_seconds: sessionData.timeSpentSeconds,
    studied_at: sessionData.startTime.toISOString()
  }

  logger.debug({ userId, chapterId, cardsStudied: sessionData.cardsStudied, accuracy: sessionData.accuracy, timeSpentSeconds: sessionData.timeSpentSeconds }, 'Creating study session')
  const { error } = await supabase
    .from('user_chapter_study_sessions')
    .insert(sessionRecord)

  if (error) {
    logger.error({ userId, chapterId, error: error.message, code: error.code }, 'Error creating study session')
    throw error
  }
  logger.info({ userId, chapterId, cardsStudied: sessionData.cardsStudied, accuracy: sessionData.accuracy, timeSpentSeconds: sessionData.timeSpentSeconds }, 'Study session created successfully')
}

/**
 * Updates chapter progress summary after a study session.
 * Input: supabase client, user id, chapter id, series id, session results
 * Output: void
 */
export async function updateChapterProgress(
  supabase: DbClient,
  userId: string,
  chapterId: string,
  seriesId: string,
  cardsStudied: number,
  accuracy: number,
  timeSpentSeconds: number
): Promise<void> {
  // Get current progress
  logger.debug({ userId, chapterId, seriesId, cardsStudied, accuracy, timeSpentSeconds }, 'Updating chapter progress')
  const { data: currentProgress, error: fetchError } = await supabase
    .from('user_chapter_progress_summary')
    .select('*')
    .eq('user_id', userId)
    .eq('chapter_id', chapterId)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    logger.error({ userId, chapterId, error: fetchError.message, code: fetchError.code }, 'Error fetching chapter progress')
    throw fetchError
  }

  const now = new Date()

  if (currentProgress) {
    // Update existing progress
    const newCardsStudied = currentProgress.cards_studied + cardsStudied
    const previousAccuracy = currentProgress.accuracy ?? 0
    const totalAccuracy = (previousAccuracy * currentProgress.cards_studied + accuracy * cardsStudied) / newCardsStudied
    const newTimeSpent = (currentProgress.time_spent_seconds || 0) + timeSpentSeconds

    const updateData: TablesUpdate<'user_chapter_progress_summary'> = {
      cards_studied: newCardsStudied,
      accuracy: totalAccuracy,
      time_spent_seconds: newTimeSpent,
      last_studied: now.toISOString(),
      updated_at: now.toISOString()
    }

    const { error } = await supabase
      .from('user_chapter_progress_summary')
      .update(updateData)
      .eq('user_id', userId)
      .eq('chapter_id', chapterId)

    if (error) {
      logger.error({ userId, chapterId, error: error.message, code: error.code }, 'Error updating chapter progress')
      throw error
    }
    logger.info({ userId, chapterId, newCardsStudied, totalAccuracy, newTimeSpent }, 'Chapter progress updated')
  } else {
    // Get total vocabulary count for this chapter
    const { count: totalCards, error: countError } = await supabase
      .from('chapter_vocabulary')
      .select('id', { count: 'exact', head: true })
      .eq('chapter_id', chapterId)

    if (countError) {
      logger.error({ userId, chapterId, error: countError.message, code: countError.code }, 'Error counting chapter vocabulary')
      throw countError
    }

    // Create new progress record
    const insertData: TablesInsert<'user_chapter_progress_summary'> = {
      user_id: userId,
      chapter_id: chapterId,
      series_id: seriesId,
      cards_studied: cardsStudied,
      total_cards: totalCards || 0,
      accuracy: accuracy,
      time_spent_seconds: timeSpentSeconds,
      last_studied: now.toISOString(),
      first_studied: now.toISOString()
    }

    const { error } = await supabase
      .from('user_chapter_progress_summary')
      .insert(insertData)

    if (error) {
      logger.error({ userId, chapterId, error: error.message, code: error.code }, 'Error creating chapter progress')
      throw error
    }
    logger.info({ userId, chapterId, cardsStudied, totalCards, accuracy, timeSpentSeconds }, 'Chapter progress created')
  }
}

/**
 * Initializes all vocabulary cards for a chapter (first time study).
 * Bulk inserts all cards with state 'New' for efficient initialization.
 * Input: supabase client, user id, deck id, chapter id
 * Output: number of cards initialized
 */
export async function initializeChapterCards(
  supabase: DbClient,
  userId: string,
  deckId: string,
  chapterId: string
): Promise<number> {
  // Get all vocabulary for this chapter
  logger.debug({ userId, deckId, chapterId }, 'Initializing chapter cards')
  const { data: chapterVocab, error: vocabError } = await supabase
    .from('chapter_vocabulary')
    .select('vocabulary_id')
    .eq('chapter_id', chapterId)

  if (vocabError) {
    logger.error({ userId, deckId, chapterId, error: vocabError.message, code: vocabError.code }, 'Error fetching chapter vocabulary for initialization')
    throw vocabError
  }

  if (!chapterVocab || chapterVocab.length === 0) {
    logger.warn({ userId, deckId, chapterId }, 'No vocabulary found for chapter')
    return 0
  }

  // Check which cards already exist
  const vocabularyIds = chapterVocab.map(cv => cv.vocabulary_id)
  const { data: existingCards, error: existingError } = await supabase
    .from('user_deck_srs_cards')
    .select('vocabulary_id')
    .eq('user_id', userId)
    .eq('deck_id', deckId)
    .in('vocabulary_id', vocabularyIds)

  if (existingError) {
    logger.error({ userId, deckId, chapterId, error: existingError.message, code: existingError.code }, 'Error checking existing cards')
    throw existingError
  }

  const existingVocabularyIds = new Set(
    (existingCards || []).map(card => card.vocabulary_id)
  )

  // Filter out cards that already exist
  const newVocabularyIds = vocabularyIds.filter(
    id => !existingVocabularyIds.has(id)
  )

  if (newVocabularyIds.length === 0) {
    logger.debug({ userId, deckId, chapterId, totalVocabulary: vocabularyIds.length, existingCount: existingVocabularyIds.size }, 'All cards already initialized')
    return 0
  }
/*
    due: Date;
    stability: number;
    difficulty: number;
    elapsed_days: number;
    scheduled_days: number;
    learning_steps: number;
    reps: number;
    lapses: number;
    state: State;
    last_review?: Date;
*/
  // Create new card data
  const newCard: Card = createNewCard()
  const cardsToInsert: TablesInsert<'user_deck_srs_cards'>[] = 
    newVocabularyIds.map(vocabularyId => ({
      user_id: userId,
      deck_id: deckId,
      vocabulary_id: vocabularyId,
      state: 'New' as Database['public']['Enums']['srs_state'],
      stability: newCard.stability,
      difficulty: newCard.difficulty,
      next_review_date: newCard.due.toISOString(),
      total_reviews: newCard.reps,
      streak_incorrect: newCard.lapses,
      last_reviewed_date: newCard.last_review?.toISOString() || null
    }))

  // Bulk insert
  logger.debug({ userId, deckId, chapterId, cardCount: cardsToInsert.length }, 'Bulk inserting new cards')
  const { error: insertError } = await supabase
    .from('user_deck_srs_cards')
    .insert(cardsToInsert)

  if (insertError) {
    logger.error({ userId, deckId, chapterId, cardCount: cardsToInsert.length, error: insertError.message, code: insertError.code }, 'Error bulk inserting cards')
    throw insertError
  }

  logger.info({ userId, deckId, chapterId, cardCount: newVocabularyIds.length }, 'Chapter cards initialized successfully')
  return newVocabularyIds.length
}

/**
 * Gets study cards for a chapter (mix of due and new cards).
 * Uses RPC function to get everything in one database call.
 * Input: supabase client, user id, chapter id, max total cards
 * Output: Array of study cards ready for review
 */
// TODO: magic numbers should be replaced with constants
export async function getStudyCards(
  supabase: DbClient,
  userId: string,
  chapterId: string,
  maxNewCards: number = 5,
  maxTotalCards: number = 20
): Promise<StudyCard[]> {
  logger.debug({ userId, chapterId, maxNewCards, maxTotalCards }, 'Getting study cards via RPC')
  const { data, error } = await supabase.rpc('get_study_cards', {
    p_user_id: userId,
    p_chapter_id: chapterId,
    p_max_new_cards: maxNewCards,
    p_max_total_cards: maxTotalCards
  })

  if (error) {
    logger.error({ userId, chapterId, error: error.message, code: error.code }, 'Error calling get_study_cards RPC')
    throw error
  }

  if (!data) {
    logger.warn({ userId, chapterId }, 'No study cards returned from RPC')
    return []
  }

  // Transform RPC result to StudyCard format
  type RpcResult = Database['public']['Functions']['get_study_cards']['Returns'][number]
  const cards: StudyCard[] = data.map((row: RpcResult) => {
    const vocabulary: Tables<'vocabulary'> = {
      id: row.vocabulary_id,
      term: row.term,
      definition: row.definition,
      example: row.example,
      sense_key: row.sense_key,
      created_at: row.vocabulary_created_at
    }

    // Convert database state string to FSRS State enum
    const stateMap: Record<string, State> = {
      'New': State.New,
      'Learning': State.Learning,
      'Review': State.Review,
      'Relearning': State.Relearning
    }
    const fsrsState = stateMap[row.state]

    const lastReview = row.last_reviewed_date
      ? new Date(row.last_reviewed_date)
      : undefined

    const fsrsCard: Card = {
      due: new Date(row.due),
      stability: row.stability ?? 0,
      difficulty: row.difficulty ?? 2.5,
      elapsed_days: 0,
      scheduled_days: row.scheduled_days ?? 0,
      learning_steps: row.learning_steps ?? 0,
      reps: row.total_reviews ?? 0,
      lapses: row.streak_incorrect ?? 0,
      state: fsrsState,
      last_review: lastReview
    }

    return {
      srsCard: fsrsCard,
      vocabulary
    }
  })

  const shuffledCards = shuffleArray(cards)
  logger.info({ userId, chapterId, cardCount: shuffledCards.length, maxNewCards, maxTotalCards }, 'Retrieved study cards')
  return shuffledCards
}

/**
 * Utility function to shuffle array
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
