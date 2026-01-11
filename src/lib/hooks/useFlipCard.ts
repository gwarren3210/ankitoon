'use client'

import { useEffect, useCallback, useRef } from 'react'

interface UseFlipCardOptions {
  isRevealed: boolean
  onRevealedChange: (revealed: boolean) => void
  isDragging: React.MutableRefObject<boolean>
  hasSwiped: React.MutableRefObject<boolean>
}

/**
 * Hook for handling card flip via spacebar and click/tap.
 * Input: reveal state, callback, gesture refs from useSwipeGestures
 * Output: click handler for the card
 */
export function useFlipCard(options: UseFlipCardOptions) {
  const { isRevealed, onRevealedChange, isDragging, hasSwiped } = options

  // Track if component is mounted for async safety
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Handle spacebar to flip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault()
        if (isMountedRef.current) {
          onRevealedChange(!isRevealed)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isRevealed, onRevealedChange])

  // Handle click/tap to flip (only if not dragging/swiping)
  const handleCardClick = useCallback(() => {
    if (!isDragging.current && !hasSwiped.current) {
      onRevealedChange(!isRevealed)
    }
  }, [isDragging, hasSwiped, isRevealed, onRevealedChange])

  return {
    handleCardClick
  }
}
