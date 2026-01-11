'use client'

import { useState, useCallback } from 'react'

/**
 * Hook for managing card queue navigation with reveal state tracking.
 * Input: array of items (cards)
 * Output: navigation state and controls
 */
export function useCardNavigation<T>(items: T[]) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [revealedState, setRevealedState] = useState(false)
  const [hasBeenRevealed, setHasBeenRevealed] = useState(false)

  // Derived values
  const currentItem = items[currentIndex]
  const isLastItem = currentIndex === items.length - 1
  const progress = items.length > 0
    ? ((currentIndex + 1) / items.length) * 100
    : 0

  // Set revealed with automatic hasBeenRevealed update
  // This avoids useEffect sync pattern for better performance
  const setRevealed = useCallback((val: boolean) => {
    setRevealedState(val)
    if (val) {
      setHasBeenRevealed(true)
    }
  }, [])

  // Move to next item and reset reveal state
  const moveToNext = useCallback(() => {
    setCurrentIndex(prev => prev + 1)
    setRevealedState(false)
    setHasBeenRevealed(false)
  }, [])

  // Reset navigation to beginning
  const reset = useCallback(() => {
    setCurrentIndex(0)
    setRevealedState(false)
    setHasBeenRevealed(false)
  }, [])

  return {
    currentIndex,
    currentItem,
    progress,
    isLastItem,
    revealed: revealedState,
    hasBeenRevealed,
    setRevealed,
    moveToNext,
    reset
  }
}
