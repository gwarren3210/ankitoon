import { AnswerOption, DistractorOption, LearnCard } from '@/lib/study/types'

/**
 * Generates answer options for a multiple choice question.
 * Uses other session cards as distractors, falls back to difficult cards.
 * Input: current card, all session cards, fallback distractors
 * Output: Array of 4 shuffled answer options
 */
export function generateAnswerOptions(
  currentCard: LearnCard,
  sessionCards: LearnCard[],
  fallbackDistractors: DistractorOption[]
): AnswerOption[] {
  const distractors = generateDistractors(
    currentCard,
    sessionCards,
    fallbackDistractors,
    3
  )

  const correctOption: AnswerOption = {
    id: currentCard.srsCardId,
    text: currentCard.definition,
    isCorrect: true
  }

  const distractorOptions: AnswerOption[] = distractors.map((text, index) => ({
    id: `distractor-${index}`,
    text,
    isCorrect: false
  }))

  return shuffleArray([correctOption, ...distractorOptions])
}

/**
 * Generates distractor definitions from available sources.
 * Priority: 1) Other session cards, 2) Difficult cards from user's deck
 * Input: current card, session cards, fallback distractors, count needed
 * Output: Array of distractor definition strings
 */
export function generateDistractors(
  currentCard: LearnCard,
  sessionCards: LearnCard[],
  fallbackDistractors: DistractorOption[],
  count: number = 3
): string[] {
  // Get definitions from other session cards (excluding current)
  const sessionDistractors = sessionCards
    .filter(c => c.srsCardId !== currentCard.srsCardId)
    .map(c => c.definition)

  // If we have enough from the session, shuffle and return
  if (sessionDistractors.length >= count) {
    return shuffleArray(sessionDistractors).slice(0, count)
  }

  // Fill remaining slots with fallback distractors (user's difficult cards)
  const needed = count - sessionDistractors.length
  const fallback = fallbackDistractors
    .filter(d => d.definition !== currentCard.definition)
    .slice(0, needed)
    .map(d => d.definition)

  const combined = [...sessionDistractors, ...fallback]

  // If still not enough, return what we have (edge case: very few cards)
  return shuffleArray(combined).slice(0, count)
}

/**
 * Requeues a card with appropriate spacing based on answer correctness.
 * Correct answers get more spacing (2-3 cards), wrong answers less (1-2).
 * Input: current queue, card to requeue, was answer correct, current index
 * Output: New queue with card inserted at appropriate position
 */
export function requeueCard(
  queue: LearnCard[],
  card: LearnCard,
  wasCorrect: boolean,
  currentIndex: number
): LearnCard[] {
  // Remove the card from its current position
  const newQueue = queue.filter((_, i) => i !== currentIndex)

  // Calculate spacing based on correctness
  // Correct: appear after 2-3 other cards
  // Wrong: appear after 1-2 other cards (need more practice)
  const minSpacing = wasCorrect ? 2 : 1
  const maxSpacing = wasCorrect ? 3 : 2

  // Random spacing within range for variety
  const spacing = Math.floor(
    Math.random() * (maxSpacing - minSpacing + 1)
  ) + minSpacing

  // Calculate insertion position (relative to start, since we removed current)
  const insertAt = Math.min(spacing, newQueue.length)

  // Insert card at the calculated position
  newQueue.splice(insertAt, 0, card)

  return newQueue
}

/**
 * Fisher-Yates shuffle algorithm.
 * Input: array to shuffle
 * Output: new shuffled array (does not mutate original)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Initializes progress tracking for all cards in a learn session.
 * Input: array of cards
 * Output: Map of cardId -> LearnCardProgress
 */
export function initializeCardProgress(
  cards: LearnCard[]
): Map<string, { correctCount: number; attemptsTotal: number }> {
  const progress = new Map<
    string,
    { correctCount: number; attemptsTotal: number }
  >()

  for (const card of cards) {
    progress.set(card.srsCardId, {
      correctCount: 0,
      attemptsTotal: 0
    })
  }

  return progress
}
