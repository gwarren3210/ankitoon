'use client'

import { useState, useEffect, useCallback } from 'react'
import { StudyCard } from '@/lib/study/types'
import { sessionStartResponseSchema } from '@/lib/study/schemas'
import { logger } from '@/lib/logger'

interface UseStudySessionOptions {
  chapterId: string
}

/**
 * Hook for managing study session lifecycle (start/end, card loading).
 * Input: chapter ID
 * Output: session state, cards, loading state, session control functions
 */
export function useStudySession(options: UseStudySessionOptions) {
  const { chapterId } = options

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [cards, setCards] = useState<StudyCard[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sessionCompleted, setSessionCompleted] = useState(false)

  // Start session on mount
  useEffect(() => {
    const startSession = async () => {
      try {
        const response = await fetch('/api/study/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chapterId })
        })

        if (!response.ok) {
          throw new Error('Failed to start session')
        }

        const data = await response.json()
        const validatedData = sessionStartResponseSchema.parse(data)
        setSessionId(validatedData.sessionId)
        setCards(validatedData.cards)
        logger.info({
          chapterId,
          sessionId: validatedData.sessionId,
          cardCount: validatedData.cards.length
        }, 'Study session started successfully')
      } catch (error) {
        logger.error({
          chapterId,
          error: error instanceof Error ? error.message : String(error)
        }, 'Error starting session')
      } finally {
        setIsLoading(false)
      }
    }

    startSession()
  }, [chapterId])

  // Complete the study session (fire and forget)
  const completeSession = useCallback(async () => {
    if (!sessionId) {
      setSessionCompleted(true)
      return
    }

    // Optimistic update: show completion immediately
    setSessionCompleted(true)

    // End session in background (fire and forget)
    fetch('/api/study/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to end session')
        }
        logger.info({ sessionId }, 'Study session ended successfully')
      })
      .catch((error) => {
        // Log error but don't block UI - session cleanup is best-effort
        logger.error({
          sessionId,
          error: error instanceof Error ? error.message : String(error)
        }, 'Error ending session')
      })
  }, [sessionId])

  // Memoized card updater (stable reference for downstream hooks)
  const updateCards = useCallback(
    (updater: (cards: StudyCard[]) => StudyCard[]) => {
      setCards(updater)
    },
    []
  )

  return {
    sessionId,
    cards,
    isLoading,
    sessionCompleted,
    setSessionCompleted,
    completeSession,
    updateCards
  }
}
