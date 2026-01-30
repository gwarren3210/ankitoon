'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Rating } from 'ts-fsrs'
import {
  LearnCard,
  DistractorOption,
  AnswerOption,
  LearnProgress,
  LearnFeedback
} from '@/lib/study/types'
import { FsrsCard, gradeCard } from '@/lib/study/fsrs'
import {
  generateAnswerOptions,
  requeueCard,
  initializeCardProgress,
  shuffleArray
} from '@/lib/learn/learnUtils'

// Time to display feedback before auto-advancing (matches highlight animation)
const FEEDBACK_DISPLAY_MS = 1200

interface UseLearnPhaseOptions {
  cards: LearnCard[]
  fallbackDistractors: DistractorOption[]
  requiredCorrect?: number
  onComplete: (
    graduatedCards: { srsCardId: string; fsrsCard: FsrsCard }[]
  ) => void
}

interface CardProgress {
  correctCount: number
  attemptsTotal: number
}

/**
 * Hook for managing the multiple choice quiz logic in learn phase.
 * Tracks progress, generates answer options, handles answers, and requeues.
 * Input: cards, distractors, completion callback
 * Output: current card, options, handlers, progress, feedback state
 */
export function useLearnPhase(options: UseLearnPhaseOptions) {
  const {
    cards: initialCards,
    fallbackDistractors,
    requiredCorrect = 2,
    onComplete
  } = options

  // Queue of cards still being learned
  const [queue, setQueue] = useState<LearnCard[]>([])
  // Progress tracking per card
  const [progressMap, setProgressMap] = useState<Map<string, CardProgress>>(
    new Map()
  )
  // Cards that have graduated (2 correct answers)
  const [graduatedCards, setGraduatedCards] = useState<
    { srsCardId: string; fsrsCard: FsrsCard }[]
  >([])
  // Total cards in original set (for progress display)
  const [totalCards, setTotalCards] = useState(0)
  // Feedback state for current answer
  const [feedback, setFeedback] = useState<LearnFeedback | null>(null)
  // Whether the session is complete
  const [isComplete, setIsComplete] = useState(false)
  // Whether we're waiting for user to dismiss feedback
  const [awaitingDismiss, setAwaitingDismiss] = useState(false)
  // Ref to prevent multiple onComplete calls (StrictMode/re-render protection)
  const hasCompletedRef = useRef(false)

  // Initialize queue and progress on first load
  useEffect(() => {
    if (initialCards.length > 0 && queue.length === 0 && !isComplete) {
      const shuffled = shuffleArray(initialCards)
      setQueue(shuffled)
      setProgressMap(initializeCardProgress(shuffled))
      setTotalCards(initialCards.length)
    }
  }, [initialCards, queue.length, isComplete])

  // Current card is the first in the queue
  const currentCard = queue[0] || null

  // Generate answer options for current card
  const answerOptions = useMemo(() => {
    if (!currentCard) return []
    return generateAnswerOptions(currentCard, queue, fallbackDistractors)
  }, [currentCard, queue, fallbackDistractors])

  // Current progress for display
  const progress: LearnProgress = useMemo(() => {
    const currentProgress = currentCard
      ? progressMap.get(currentCard.srsCardId)
      : null

    return {
      graduated: graduatedCards.length,
      total: totalCards,
      currentCorrect: currentProgress?.correctCount || 0,
      requiredCorrect
    }
  }, [graduatedCards.length, totalCards, currentCard, progressMap, requiredCorrect])

  /**
   * Handles user selecting an answer option.
   * Updates progress, shows feedback, and requeues or graduates card.
   */
  const handleAnswer = useCallback(
    (optionId: string) => {
      if (!currentCard || awaitingDismiss) return

      const selectedOption = answerOptions.find((o) => o.id === optionId)
      if (!selectedOption) return

      const isCorrect = selectedOption.isCorrect
      const currentProgress = progressMap.get(currentCard.srsCardId) || {
        correctCount: 0,
        attemptsTotal: 0
      }

      // Update progress
      const newProgress: CardProgress = {
        correctCount: isCorrect ? currentProgress.correctCount + 1 : 0,
        attemptsTotal: currentProgress.attemptsTotal + 1
      }

      setProgressMap((prev) => {
        const updated = new Map(prev)
        updated.set(currentCard.srsCardId, newProgress)
        return updated
      })

      // Set feedback
      setFeedback({
        shown: true,
        isCorrect,
        correctAnswer: currentCard.definition,
        selectedAnswer: selectedOption.text
      })

      // Check if card graduates (2 correct in a row)
      if (isCorrect && newProgress.correctCount >= requiredCorrect) {
        // Graduate the card - apply FSRS "Good" rating
        const graded = gradeCard(currentCard.srsCard, Rating.Good)

        setGraduatedCards((prev) => [
          ...prev,
          { srsCardId: currentCard.srsCardId, fsrsCard: graded.card }
        ])

        // Delay card switch to match feedback display time
        setTimeout(() => {
          // Remove from queue (switches to next card)
          setQueue((prev) => prev.slice(1))
          setFeedback(null)
          // Check if all cards graduated
          if (queue.length === 1) {
            // This was the last card
            setIsComplete(true)
          }
        }, FEEDBACK_DISPLAY_MS)
      } else if (isCorrect) {
        // Delay card switch to match feedback display time
        setTimeout(() => {
          // Requeue with spacing (switches to next card)
          setQueue((prev) => requeueCard(prev, currentCard, true, 0))
          setFeedback(null)
        }, FEEDBACK_DISPLAY_MS)
      } else {
        // Wrong answer - wait for user to dismiss feedback
        setAwaitingDismiss(true)
      }
    },
    [
      currentCard,
      answerOptions,
      progressMap,
      requiredCorrect,
      queue,
      awaitingDismiss
    ]
  )

  /**
   * Dismisses feedback after wrong answer (user must acknowledge).
   * Requeues the card with shorter spacing.
   */
  const dismissFeedback = useCallback(() => {
    if (!currentCard || !awaitingDismiss) return

    // Requeue with shorter spacing (wrong answer)
    setQueue((prev) => requeueCard(prev, currentCard, false, 0))

    setFeedback(null)
    setAwaitingDismiss(false)
  }, [currentCard, awaitingDismiss])

  // Call onComplete when all cards are graduated (only once)
  useEffect(() => {
    if (isComplete && graduatedCards.length > 0 && !hasCompletedRef.current) {
      hasCompletedRef.current = true
      onComplete(graduatedCards)
    }
  }, [isComplete, graduatedCards, onComplete])

  return {
    currentCard,
    answerOptions,
    handleAnswer,
    feedback,
    dismissFeedback,
    progress,
    isComplete,
    awaitingDismiss
  }
}
