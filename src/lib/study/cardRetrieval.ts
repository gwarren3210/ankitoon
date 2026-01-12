import { createClient } from '@/lib/supabase/server'
import { Database, Tables } from '@/types/database.types'
import { Card } from 'ts-fsrs'
import { logger } from '@/lib/logger'
import { StudyCard } from '@/lib/study/types'
import { dbStateToFsrsState, shuffleArray } from '@/lib/study/utils'

/**
 * Gets study cards for a chapter (mix of due and new cards).
 * Uses RPC function to get everything in one database call.
 * Settings (max_new_cards, max_total_cards) are fetched from profile table.
 * Input: user id, chapter id, whether chapter is completed
 * Output: Array of study cards ready for review
 */
export async function getStudyCards(
  userId: string,
  chapterId: string,
  isChapterCompleted: boolean = false
): Promise<StudyCard[]> {
  const supabase = await createClient()
  logger.debug({ userId, chapterId, isChapterCompleted }, 'Getting study cards via RPC')
  const { data, error } = await supabase.rpc('get_study_cards', {
    p_user_id: userId,
    p_chapter_id: chapterId
  })

  if (error) {
    logger.error({
      userId,
      chapterId,
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    }, 'Error calling get_study_cards RPC')
    throw error
  }

  if (!data) {
    logger.warn({ userId, chapterId }, 'RPC returned null - no data')
    return []
  }

  if (Array.isArray(data) && data.length === 0) {
    logger.warn({ userId, chapterId }, 'RPC returned empty array - no cards to study')
    return []
  }

  const cards = transformRpcResultToStudyCards(data, isChapterCompleted)
  const shuffledCards = shuffleArray(cards)
  logger.info({ userId, chapterId, cardCount: shuffledCards.length }, 'Retrieved study cards')
  return shuffledCards
}

/**
 * Transforms RPC result to StudyCard format.
 * Input: RPC result data, whether chapter is completed
 * Output: Array of StudyCard with resolved displayExample
 */
function transformRpcResultToStudyCards(
  data: Database['public']['Functions']['get_study_cards']['Returns'],
  isChapterCompleted: boolean
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

    const globalExample = row.example || null
    const chapterExample = row.chapter_example || null
    const displayExample = selectDisplayExample(
      chapterExample,
      globalExample,
      isChapterCompleted
    )

    return {
      srsCard: fsrsCard,
      vocabulary,
      globalExample,
      chapterExample,
      displayExample,
      srsCardId: row.srs_card_id
    }
  })
}

/**
 * Selects the appropriate example to display based on chapter completion.
 * If completed: prefer chapter example, fall back to global.
 * If not completed: show global example only.
 * Input: chapter example, global example, completion status
 * Output: the example to display or null
 */
export function selectDisplayExample(
  chapterExample: string | null,
  globalExample: string | null,
  isChapterCompleted: boolean
): string | null {
  if (isChapterCompleted) {
    return chapterExample ?? globalExample
  }
  return globalExample
}

