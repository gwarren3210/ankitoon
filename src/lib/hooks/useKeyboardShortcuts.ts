'use client'

import { useEffect } from 'react'
import { FsrsRating } from '@/lib/study/fsrs'

interface UseKeyboardShortcutsOptions {
  onRate: (rating: FsrsRating) => void
  enabled: boolean
}

/**
 * Hook for handling keyboard shortcuts for rating cards.
 * Arrow keys: Left=Again, Down=Hard, Right=Good, Up=Easy
 * Number keys: 1=Again, 2=Hard, 3=Good, 4=Easy
 * Input: rating callback, enabled flag
 * Output: none (side effect only)
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions) {
  const { onRate, enabled } = options

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      // Don't handle if disabled
      if (!enabled) {
        return
      }

      let rating: FsrsRating | null = null

      // Arrow keys
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        rating = FsrsRating.Again // 1
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        rating = FsrsRating.Hard // 2
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        rating = FsrsRating.Good // 3
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        rating = FsrsRating.Easy // 4
      }
      // Number keys
      else if (e.key === '1') {
        e.preventDefault()
        rating = FsrsRating.Again
      } else if (e.key === '2') {
        e.preventDefault()
        rating = FsrsRating.Hard
      } else if (e.key === '3') {
        e.preventDefault()
        rating = FsrsRating.Good
      } else if (e.key === '4') {
        e.preventDefault()
        rating = FsrsRating.Easy
      }

      if (rating !== null) {
        onRate(rating)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onRate, enabled])
}
