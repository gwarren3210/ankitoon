'use client'

import { useState, useEffect, useCallback } from 'react'
import { StudyCard } from '@/lib/study/types'
import { sessionStartResponseSchema } from '@/lib/study/schemas'
import { postJson } from '@/lib/api/client'
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
  const [error, setError] = useState<string | null>(null)

  // Start session on mount
  useEffect(() => {
    const startSession = async () => {
      try {
        // DEBUG: Log before request
        console.log('[useStudySession] Starting session request', { chapterId })

        const response = await postJson('/api/study/session', { chapterId })

        // DEBUG: Log response status
        console.log('[useStudySession] Response received', {
          status: response.status,
          ok: response.ok,
          statusText: response.statusText
        })

        if (!response.ok) {
          const errorBody = await response.text()
          console.error('[useStudySession] Non-OK response body:', errorBody)
          throw new Error('Failed to start session')
        }

        const data = await response.json()

        // DEBUG: Log raw response data
        console.log('[useStudySession] Raw response data', {
          hasSessionId: !!data.sessionId,
          hasCards: !!data.cards,
          cardCount: data.cards?.length
        })

        const validatedData = sessionStartResponseSchema.parse(data)
        setSessionId(validatedData.sessionId)
        setCards(validatedData.cards)
        logger.info({
          chapterId,
          sessionId: validatedData.sessionId,
          cardCount: validatedData.cards.length
        }, 'Study session started successfully')
      } catch (error) {
        // DEBUG: Log error details
        console.error('[useStudySession] Request failed', {
          chapterId,
          errorType: error?.constructor?.name,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined
        })

        const errorMessage = error instanceof Error
          ? error.message
          : 'Failed to start study session'
        setError(errorMessage)
        logger.error({
          chapterId,
          error: errorMessage
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
    postJson('/api/study/session', { sessionId })
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
    updateCards,
    error
  }
}
