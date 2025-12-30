import { State } from 'ts-fsrs'
import { Database, Tables } from '@/types/database.types'
import { Card } from 'ts-fsrs'
import { StudyCard } from './types'

/**
 * Converts database state string to FSRS State enum
 * Input: state string
 * Output: FSRS State enum
 */
export function dbStateToFsrsState(state: string): State {
  const stateMap: Record<string, State> = {
    'New': State.New,
    'Learning': State.Learning,
    'Review': State.Review,
    'Relearning': State.Relearning
  }
  return stateMap[state] || State.New
}

/**
 * Converts FSRS State enum to database state string
 * Input: FSRS State enum
 * Output: database state string
 */
export function fsrsStateToDbState(state: State): Database['public']['Enums']['srs_state'] {
  const stateMap: Record<State, string> = {
    [State.New]: 'New',
    [State.Learning]: 'Learning',
    [State.Review]: 'Review',
    [State.Relearning]: 'Relearning'
  }
  return stateMap[state] as Database['public']['Enums']['srs_state']
}

/**
 * Calculates elapsed days since last review
 * Input: last review date or null
 * Output: number of elapsed days
 */
export function calculateElapsedDays(lastReview: string | null): number {
  if (!lastReview) return 0
  const now = new Date()
  const lastReviewDate = new Date(lastReview)
  return Math.floor((now.getTime() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Converts database SRS card row to FSRS Card
 * Input: database card row data
 * Output: FSRS Card
 */
export function dbCardToFsrsCard(card: Database['public']['Tables']['user_deck_srs_cards']['Row']): Card {
  const lastReview = card.last_reviewed_date ? new Date(card.last_reviewed_date) : undefined
  const elapsedDays = calculateElapsedDays(card.last_reviewed_date)

  return {
    due: card.due ? new Date(card.due) : new Date(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: elapsedDays,
    scheduled_days: card.scheduled_days ?? 0,
    learning_steps: card.learning_steps ?? 0,
    reps: card.total_reviews,
    lapses: card.streak_incorrect,
    state: dbStateToFsrsState(card.state),
    last_review: lastReview
  }
}

/**
 * Shuffles array using Fisher-Yates algorithm
 * Input: array
 * Output: shuffled array
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

