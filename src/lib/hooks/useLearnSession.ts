'use client'

import { useState, useEffect, useCallback } from 'react'
import { LearnCard, DistractorOption } from '@/lib/study/types'
import { FsrsCard } from '@/lib/study/fsrs'
import { learnSessionStartResponseSchema } from '@/lib/learn/schemas'
import { postJson } from '@/lib/api/client'
import { logger } from '@/lib/logger'

interface UseLearnSessionOptions {
  chapterId: string
}

interface GraduatedCard {
  srsCardId: string
  fsrsCard: FsrsCard
}

/**
 * Hook for managing learn session lifecycle (start/complete, card loading).
 * Similar to useStudySession but for the multiple choice learn flow.
 * Input: chapter ID
 * Output: session state, cards, distractors, loading state, complete function
 */
export function useLearnSession(options: UseLearnSessionOptions) {
  const { chapterId } = options

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [deckId, setDeckId] = useState<string | null>(null)
  const [cards, setCards] = useState<LearnCard[]>([])
  const [fallbackDistractors, setFallbackDistractors] = useState<
    DistractorOption[]
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCompleting, setIsCompleting] = useState(false)
  const [sessionCompleted, setSessionCompleted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Start session on mount
  useEffect(() => {
    const startSession = async () => {
      try {
        const response = await postJson('/api/learn/session', { chapterId })

        if (!response.ok) {
          const errorBody = await response.text()
          console.error('[useLearnSession] Non-OK response:', errorBody)
          throw new Error('Failed to start learn session')
        }

        const data = await response.json()
        const validatedData = learnSessionStartResponseSchema.parse(data)

        setSessionId(validatedData.sessionId)
        setDeckId(validatedData.deckId)
        // Limit to max 20 new words per session
        const limitedCards = validatedData.cards.slice(0, 20)
        setCards(limitedCards)
        setFallbackDistractors(validatedData.fallbackDistractors)

        logger.info(
          {
            chapterId,
            sessionId: validatedData.sessionId,
            cardCount: validatedData.cards.length,
            distractorCount: validatedData.fallbackDistractors.length
          },
          'Learn session started successfully'
        )
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to start learn session'
        setError(errorMessage)
        logger.error(
          {
            chapterId,
            error: errorMessage
          },
          'Error starting learn session'
        )
      } finally {
        setIsLoading(false)
      }
    }

    startSession()
  }, [chapterId])

  /**
   * Completes the learn session by persisting graduated cards.
   * Input: array of graduated cards with their FSRS state
   * Output: void (fires and forgets with optimistic UI)
   */
  const completeSession = useCallback(
    async (graduatedCards: GraduatedCard[]) => {
      if (!sessionId || !deckId) {
        setSessionCompleted(true)
        return
      }

      // Optimistic update: show completion immediately
      setSessionCompleted(true)
      setIsCompleting(true)

      try {
        const response = await postJson('/api/learn/complete', {
          sessionId,
          deckId,
          graduatedCards
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to complete session')
        }

        const data = await response.json()
        logger.info(
          {
            sessionId,
            cardsGraduated: data.cardsGraduated
          },
          'Learn session completed successfully'
        )
      } catch (error) {
        // Log error but don't block UI - session cleanup is best-effort
        logger.error(
          {
            sessionId,
            error: error instanceof Error ? error.message : String(error)
          },
          'Error completing learn session'
        )
      } finally {
        setIsCompleting(false)
      }
    },
    [sessionId, deckId]
  )

  return {
    sessionId,
    deckId,
    cards,
    fallbackDistractors,
    isLoading,
    isCompleting,
    sessionCompleted,
    completeSession,
    error
  }
}
