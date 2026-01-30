import { createClient } from '@/lib/supabase/server'
import { LearnCard, DistractorOption } from '@/lib/study/types'
import { Card, State } from 'ts-fsrs'
import { logger } from '@/lib/logger'
import { randomUUID } from 'crypto'

// ============================================================================
// Types
// ============================================================================

/**
 * Type for get_learn_cards RPC result.
 * Note: This type is defined inline until migrations are applied
 * and database types are regenerated.
 */
interface LearnCardsRpcResult {
  srs_card_id: string
  card_type: 'vocabulary' | 'grammar'
  vocabulary_id: string | null
  term: string | null
  definition: string | null
  example: string | null
  chapter_example: string | null
  sense_key: string | null
  vocabulary_created_at: string | null
  grammar_id: string | null
  pattern: string | null
  grammar_definition: string | null
  grammar_example: string | null
  grammar_sense_key: string | null
  grammar_created_at: string | null
  grammar_chapter_example: string | null
  state: string
  difficulty: number
}

type LearnSessionResult =
  | { success: true; data: LearnSessionData }
  | { success: false; error: LearnSessionError }

interface LearnSessionData {
  sessionId: string
  deckId: string
  cards: LearnCard[]
  fallbackDistractors: DistractorOption[]
  numCards: number
}

interface LearnSessionError {
  type:
    | 'chapter_not_found'
    | 'no_new_cards'
    | 'deck_not_found'
    | 'card_retrieval_failed'
  message: string
}

type CompleteSessionResult =
  | { success: true; data: { cardsGraduated: number } }
  | { success: false; error: { type: 'persist_failed'; message: string } }

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Starts a learn session by fetching NEW cards for a chapter.
 * Input: user id, chapter id
 * Output: Result with session data or error
 */
export async function startLearnSession(
  userId: string,
  chapterId: string
): Promise<LearnSessionResult> {
  const supabase = await createClient()

  // Get deck ID for this chapter
  const deckResult = await getDeckId(supabase, userId, chapterId)
  if (!deckResult.success) {
    return { success: false, error: deckResult.error }
  }
  const deckId = deckResult.data

  // Get learn cards (NEW state only)
  const cardsResult = await getLearnCards(supabase, userId, chapterId, deckId)
  if (!cardsResult.success) {
    return { success: false, error: cardsResult.error }
  }

  // Get fallback distractors from user's difficult cards
  const distractors = await getDifficultCards(supabase, userId)

  // Generate session ID
  const sessionId = randomUUID()

  logger.info(
    {
      userId,
      chapterId,
      sessionId,
      cardCount: cardsResult.data.length,
      distractorCount: distractors.length
    },
    'Learn session started'
  )

  return {
    success: true,
    data: {
      sessionId,
      deckId,
      cards: cardsResult.data,
      fallbackDistractors: distractors,
      numCards: cardsResult.data.length
    }
  }
}

/**
 * Completes a learn session by persisting graduated cards.
 * Input: user id, deck id, graduated cards with FSRS state
 * Output: Result with cards graduated count or error
 */
export async function completeLearnSession(
  userId: string,
  deckId: string,
  graduatedCards: Array<{
    srsCardId: string
    state: string
    stability: number
    difficulty: number
    due: string
    scheduledDays: number
    learningSteps: number
  }>
): Promise<CompleteSessionResult> {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('persist_learn_session', {
    p_user_id: userId,
    p_deck_id: deckId,
    p_graduated_cards: graduatedCards.map((card) => ({
      srs_card_id: card.srsCardId,
      state: card.state,
      stability: card.stability,
      difficulty: card.difficulty,
      due: card.due,
      scheduled_days: card.scheduledDays,
      learning_steps: card.learningSteps
    }))
  })

  if (error) {
    logger.error(
      { userId, deckId, error: error.message },
      'Failed to persist learn session'
    )
    return {
      success: false,
      error: { type: 'persist_failed', message: error.message }
    }
  }

  logger.info(
    { userId, deckId, cardsGraduated: data.cards_graduated },
    'Learn session completed'
  )

  return {
    success: true,
    data: { cardsGraduated: data.cards_graduated }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Gets the deck ID for a user's chapter.
 */
async function getDeckId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  chapterId: string
): Promise<
  | { success: true; data: string }
  | { success: false; error: LearnSessionError }
> {
  const { data, error } = await supabase
    .from('user_chapter_decks')
    .select('id')
    .eq('user_id', userId)
    .eq('chapter_id', chapterId)
    .single()

  if (error || !data) {
    return {
      success: false,
      error: {
        type: 'deck_not_found',
        message: 'No deck found for this chapter. Have you started studying?'
      }
    }
  }

  return { success: true, data: data.id }
}

/**
 * Gets NEW cards for a chapter via RPC.
 */
async function getLearnCards(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  chapterId: string,
  deckId: string
): Promise<
  | { success: true; data: LearnCard[] }
  | { success: false; error: LearnSessionError }
> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('get_learn_cards', {
    p_user_id: userId,
    p_chapter_id: chapterId
  })

  if (error) {
    return {
      success: false,
      error: { type: 'card_retrieval_failed', message: error.message }
    }
  }

  if (!data || data.length === 0) {
    return {
      success: false,
      error: {
        type: 'no_new_cards',
        message: 'No new cards to learn in this chapter'
      }
    }
  }

  const cards: LearnCard[] = data.map((row: LearnCardsRpcResult) =>
    transformRpcRowToLearnCard(row, deckId)
  )

  return { success: true, data: cards }
}

/**
 * Gets user's most difficult cards for distractor fallback.
 */
async function getDifficultCards(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<DistractorOption[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('get_difficult_cards', {
    p_user_id: userId,
    p_limit: 10
  })

  if (error || !data) {
    return []
  }

  return data.map(
    (row: { term: string; definition: string; difficulty: number }) => ({
      term: row.term,
      definition: row.definition,
      difficulty: row.difficulty
    })
  )
}

/**
 * Transforms RPC result row to LearnCard.
 */
function transformRpcRowToLearnCard(
  row: LearnCardsRpcResult,
  deckId: string
): LearnCard {
  const isVocabulary = row.card_type === 'vocabulary'

  const fsrsCard: Card = {
    due: new Date(),
    stability: 0,
    difficulty: row.difficulty ?? 0,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: State.New,
    last_review: undefined
  }

  return {
    srsCard: fsrsCard,
    srsCardId: row.srs_card_id,
    deckId,
    cardType: row.card_type,
    vocabulary: isVocabulary
      ? {
          id: row.vocabulary_id!,
          term: row.term!,
          definition: row.definition!,
          example: row.example,
          sense_key: row.sense_key!,
          created_at: row.vocabulary_created_at!
        }
      : null,
    grammar: !isVocabulary
      ? {
          id: row.grammar_id!,
          pattern: row.pattern!,
          definition: row.grammar_definition!,
          example: row.grammar_example,
          sense_key: row.grammar_sense_key!,
          created_at: row.grammar_created_at!
        }
      : null,
    term: isVocabulary ? row.term! : row.pattern!,
    definition: isVocabulary ? row.definition! : row.grammar_definition!,
    chapterExample: isVocabulary ? row.chapter_example : row.grammar_chapter_example,
    globalExample: isVocabulary ? row.example : row.grammar_example,
    displayExample: isVocabulary
      ? row.chapter_example || row.example
      : row.grammar_chapter_example || row.grammar_example
  }
}
