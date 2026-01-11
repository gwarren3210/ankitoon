'use client'

import { useState, useCallback } from 'react'
import { StudyCard } from '@/lib/study/types'
import { FsrsRating } from '@/lib/study/fsrs'
import { rateResponseSchema } from '@/lib/study/schemas'
import { logger } from '@/lib/logger'

/**
 * Inserts a card into the cards array and sorts by due date.
 * Input: cards array, card to insert, current index
 * Output: new cards array with card inserted and sorted by due date
 */
function insertCardByDueDate(
  cards: StudyCard[],
  cardToInsert: StudyCard,
  currentIndex: number
): StudyCard[] {
  const studiedCards = cards.slice(0, currentIndex + 1)
  const remainingQueue = cards.slice(currentIndex + 1)
  remainingQueue.push(cardToInsert)
  remainingQueue.sort((a, b) =>
    a.srsCard.due.getTime() - b.srsCard.due.getTime()
  )
  return [...studiedCards, ...remainingQueue]
}

interface UseRatingSubmissionOptions {
  sessionId: string | null
  currentCard: StudyCard | undefined
  currentIndex: number
  isLastCard: boolean
  hasBeenRevealed: boolean
  onCardRated: () => void
  onSessionComplete: () => Promise<void>
  updateCards: (updater: (cards: StudyCard[]) => StudyCard[]) => void
}

/**
 * Hook for handling card rating submission with optimistic updates.
 * Input: session state, card state, callbacks
 * Output: rating handler and submission state
 */
export function useRatingSubmission(options: UseRatingSubmissionOptions) {
  const {
    sessionId,
    currentCard,
    currentIndex,
    isLastCard,
    hasBeenRevealed,
    onCardRated,
    onSessionComplete,
    updateCards
  } = options

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastRating, setLastRating] = useState<FsrsRating | null>(null)
  const [ratings, setRatings] = useState<FsrsRating[]>([])

  const handleRate = useCallback(async (rating: FsrsRating) => {
    if (!currentCard || !sessionId || isSubmitting || !hasBeenRevealed) return

    setIsSubmitting(true)
    setLastRating(rating)

    try {
      setRatings(prev => [...prev, rating])

      const response = await fetch('/api/study/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          vocabularyId: currentCard.vocabulary.id,
          rating,
          card: currentCard.srsCard
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to submit rating')
      }

      const data = await response.json()
      const validatedData = rateResponseSchema.parse(data)

      // Update card state with reviewed card
      updateCards(prev => {
        const updatedCard: StudyCard = {
          ...currentCard,
          srsCard: validatedData.card
        }
        const updatedCards = prev.map((c, idx) =>
          idx === currentIndex
            ? updatedCard
            : c
        )

        // If reAddCard is true (rating 1), insert card in correct position
        if (validatedData.reAddCard) {
          return insertCardByDueDate(updatedCards, updatedCard, currentIndex)
        }

        return updatedCards
      })

      // Log and handle navigation
      logger.debug({
        sessionId,
        vocabularyId: currentCard.vocabulary.id,
        rating,
        isLastCard,
        reAddCard: validatedData.reAddCard
      }, 'Card rated successfully')

      if (isLastCard && !validatedData.reAddCard) {
        await onSessionComplete()
      } else {
        onCardRated()
      }
    } catch (error) {
      logger.error({
        sessionId,
        vocabularyId: currentCard?.vocabulary.id,
        rating,
        error: error instanceof Error ? error.message : String(error)
      }, 'Error submitting rating')

      // Still advance on error to prevent UI lockup
      if (isLastCard) {
        await onSessionComplete()
      } else {
        onCardRated()
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [
    currentCard,
    currentIndex,
    isLastCard,
    isSubmitting,
    sessionId,
    hasBeenRevealed,
    onCardRated,
    onSessionComplete,
    updateCards
  ])

  return {
    handleRate,
    isSubmitting,
    lastRating,
    ratings
  }
}
