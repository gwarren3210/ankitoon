/**
 * FSRS (Free Spaced Repetition Scheduler) algorithm implementation
 * Uses ts-fsrs package for optimal spaced repetition scheduling
 */

import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Card as FsrsCard,
  Grade as FsrsGrade,
  ReviewLog,
  Rating,
} from 'ts-fsrs'

// Initialize FSRS with default parameters
const params = generatorParameters({
  enable_fuzz: true,
  enable_short_term: true
})
const f = fsrs(params)


/**
 * Grades a card with the given grade and returns the updated card
 * Input: card, grade
 * Output: updated card
 */
export function gradeCard(card: FsrsCard, grade: FsrsGrade): { card: FsrsCard, log: ReviewLog } {
  const now = new Date()
  
  // Use ts-fsrs to get the updated card for the given grade
  const gradedCard = f.next(card, now, grade)
  
  return {
    card: gradedCard.card,
    log: gradedCard.log
  }
}

/**
 * Creates a new card with default FSRS values
 * Input: vocabularyId
 * Output: new FsrsCard
 */
export function createNewCard(): FsrsCard {
  return createEmptyCard()
}

/**
 * Checks if a card is due for review
 * Input: card
 * Output: boolean
 */
export function isCardDue(card: FsrsCard): boolean {
  return card.due <= new Date()
}

/**
 * Formats the next review time as a human-readable string
 * Input: date (next review date)
 * Output: formatted string (e.g., "5 min", "2.5 hr", "3 days", "1.2 mo", "2.5 yr", "due", "new card")
 */
export function getNextReviewTime(date: Date | null | undefined): string {
  if (!date) return 'new card'
  const now = new Date()
  if (date.getTime() - now.getTime() < 0) return 'due'
  const MS_TO_MIN = 1000 * 60
  const MS_TO_HOUR = MS_TO_MIN * 60
  const MS_TO_DAY = MS_TO_HOUR * 24
  const MS_TO_MONTH = MS_TO_DAY * 30
  const MS_TO_YEAR = MS_TO_DAY * 365
  const diffTime = Math.abs(date.getTime() - now.getTime())
  if (diffTime < MS_TO_HOUR)
    return '<' + Math.ceil(diffTime / MS_TO_MIN) + ' min'
  if (diffTime < MS_TO_DAY)
    return (diffTime / MS_TO_HOUR).toFixed(1) + ' hr'
  if (diffTime < MS_TO_MONTH)
    return (diffTime / MS_TO_DAY).toFixed(1) + ' days'
  if (diffTime < MS_TO_YEAR)
    return (diffTime / MS_TO_MONTH).toFixed(1) + ' mo'
  return (diffTime / MS_TO_YEAR).toFixed(1) + ' yr'
}

/**
 * Gets interval previews for all ratings (1-4)
 * Input: card
 * Output: object with rating keys (1-4) and formatted interval strings
 */
export function getIntervalPreviews(card: FsrsCard): Record<number, string> {
  const now = new Date()
  const preview = f.repeat(card, now)
  //const intervals = preview.map(p => getNextReviewTime(p.card.due))
  return {
    [Rating.Again]: getNextReviewTime(preview[Rating.Again].card.due),
    [Rating.Hard]: getNextReviewTime(preview[Rating.Hard].card.due),
    [Rating.Good]: getNextReviewTime(preview[Rating.Good].card.due),
    [Rating.Easy]: getNextReviewTime(preview[Rating.Easy].card.due)
  }
}

export type { Card as FsrsCard, ReviewLog as FsrsReviewLog } from 'ts-fsrs'
export { Rating as FsrsRating, State as FsrsState } from 'ts-fsrs'