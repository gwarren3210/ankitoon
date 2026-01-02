import { Database, Tables } from '@/types/database.types'
import { Card } from 'ts-fsrs'
import { logger } from '@/lib/logger'
import { DbClient, StudyCard } from './types'
import { dbStateToFsrsState, shuffleArray } from './utils'

/**
 * Gets study cards for a chapter (mix of due and new cards).
 * Uses RPC function to get everything in one database call.
 * Settings (max_new_cards, max_total_cards) are fetched from profile table.
 * Input: supabase client, user id, chapter id
 * Output: Array of study cards ready for review
 */
export async function getStudyCards(
  supabase: DbClient,
  userId: string,
  chapterId: string
): Promise<StudyCard[]> {
  logger.debug({ userId, chapterId }, 'Getting study cards via RPC')
  const { data, error } = await supabase.rpc('get_study_cards', {
    p_user_id: userId,
    p_chapter_id: chapterId
  })

  if (error) {
    logger.error({ userId, chapterId, error: error.message, code: error.code }, 'Error calling get_study_cards RPC')
    throw error
  }

  if (!data) {
    logger.warn({ userId, chapterId }, 'No study cards returned from RPC')
    return []
  }

  const cards = transformRpcResultToStudyCards(data)
  const shuffledCards = shuffleArray(cards)
  logger.info({ userId, chapterId, cardCount: shuffledCards.length }, 'Retrieved study cards')
  return shuffledCards
}

/**
 * Transforms RPC result to StudyCard format
 * Input: RPC result data
 * Output: Array of StudyCard
 */
function transformRpcResultToStudyCards(
  data: Database['public']['Functions']['get_study_cards']['Returns']
): StudyCard[] {
  type RpcResult = Database['public']['Functions']['get_study_cards']['Returns'][number]
  
  return data.map((row: RpcResult) => {
    const vocabulary: Tables<'vocabulary'> = {
      id: row.vocabulary_id,
      term: row.term,
      definition: row.definition,
      example: row.example,
      sense_key: row.sense_key,
      created_at: row.vocabulary_created_at
    }

    const fsrsState = dbStateToFsrsState(row.state)
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
      vocabulary,
      srsCardId: row.srs_card_id
    }
  })
}

