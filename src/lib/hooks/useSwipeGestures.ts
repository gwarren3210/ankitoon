'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { FsrsRating } from '@/lib/study/fsrs'

/**
 * Swipe direction with null for idle state.
 * null = no active swipe, direction = swipe in progress
 */
export type SwipeDirection = 'left' | 'right' | 'up' | 'down' | null

const DEFAULT_SWIPE_THRESHOLD = 50

interface UseSwipeGesturesOptions {
  threshold?: number
  onSwipe: (rating: FsrsRating) => void
  enabled: boolean
}

/**
 * Maps swipe direction to FSRS rating.
 * Input: swipe direction
 * Output: FSRS rating (1-4)
 */
function getRatingFromSwipe(direction: SwipeDirection): FsrsRating | null {
  if (direction === 'left') return FsrsRating.Again   // 1
  if (direction === 'down') return FsrsRating.Hard    // 2
  if (direction === 'right') return FsrsRating.Good   // 3
  if (direction === 'up') return FsrsRating.Easy      // 4
  return null
}

/**
 * Maps FSRS rating to Tailwind color class.
 * Input: FSRS rating
 * Output: Tailwind color class string
 */
export function getRatingColor(rating: FsrsRating): string {
  if (rating === FsrsRating.Again) return 'text-brand-red'
  if (rating === FsrsRating.Hard) return 'text-brand-orange'
  if (rating === FsrsRating.Good) return 'text-accent'
  if (rating === FsrsRating.Easy) return 'text-brand-green'
  return 'text-muted-foreground'
}

/**
 * Hook for detecting swipe gestures and mapping them to FSRS ratings.
 * Input: threshold, onSwipe callback, enabled flag
 * Output: event handlers, swipe state, transform string, animation state
 */
export function useSwipeGestures(options: UseSwipeGesturesOptions) {
  const { threshold = DEFAULT_SWIPE_THRESHOLD, onSwipe, enabled } = options

  // Animation and visual state
  const [isAnimating, setIsAnimating] = useState(false)
  const [swipeDirection, setSwipeDirection] = useState<SwipeDirection>(null)
  const [swipeOffset, setSwipeOffset] = useState({ x: 0, y: 0 })
  const [swipeDistance, setSwipeDistance] = useState(0)

  // Refs for gesture tracking (no re-renders needed)
  const startPos = useRef<{ x: number; y: number } | null>(null)
  const isDragging = useRef(false)
  const hasSwiped = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])

  // Core gesture handlers
  const handleStart = useCallback((clientX: number, clientY: number) => {
    startPos.current = { x: clientX, y: clientY }
    isDragging.current = false
    hasSwiped.current = false
  }, [])

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!startPos.current) return

    const deltaX = clientX - startPos.current.x
    const deltaY = clientY - startPos.current.y
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    // Start dragging if moved more than 10px
    if (distance > 10) {
      isDragging.current = true
      hasSwiped.current = true

      // Only apply swipe visual feedback when enabled
      if (enabled) {
        setSwipeOffset({ x: deltaX, y: deltaY })
        setSwipeDistance(distance)

        // Determine swipe direction
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          setSwipeDirection(deltaX > 0 ? 'right' : 'left')
        } else {
          setSwipeDirection(deltaY > 0 ? 'down' : 'up')
        }
      }
    }
  }, [enabled])

  const handleEnd = useCallback(() => {
    if (!isDragging.current) return

    const { x, y } = swipeOffset
    const distance = Math.sqrt(x * x + y * y)

    // Only trigger rating when enabled and threshold exceeded
    if (enabled && distance > threshold && isMountedRef.current) {
      let rating: FsrsRating

      if (Math.abs(x) > Math.abs(y)) {
        // Horizontal swipe
        rating = x > 0 ? FsrsRating.Good : FsrsRating.Again
      } else {
        // Vertical swipe
        rating = y > 0 ? FsrsRating.Hard : FsrsRating.Easy
      }

      setIsAnimating(true)

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Delay rating callback to allow animation
      timeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          onSwipe(rating)
          setIsAnimating(false)
        }
        timeoutRef.current = null
      }, 200)
    }

    // Reset visual state
    setSwipeOffset({ x: 0, y: 0 })
    setSwipeDistance(0)
    setSwipeDirection(null)
    isDragging.current = false
    startPos.current = null
  }, [swipeOffset, threshold, enabled, onSwipe])

  // Touch event handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    handleStart(touch.clientX, touch.clientY)
  }, [handleStart])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      handleMove(touch.clientX, touch.clientY)
    }
  }, [handleMove])

  const onTouchEnd = useCallback(() => {
    handleEnd()
  }, [handleEnd])

  // Mouse event handlers (for desktop)
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    handleStart(e.clientX, e.clientY)
  }, [handleStart])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (e.buttons === 1) { // Left mouse button
      handleMove(e.clientX, e.clientY)
    }
  }, [handleMove])

  const onMouseUp = useCallback(() => {
    handleEnd()
  }, [handleEnd])

  // Calculate CSS transform
  const transform = swipeOffset.x !== 0 || swipeOffset.y !== 0
    ? `translate(${swipeOffset.x * 0.3}px, ${swipeOffset.y * 0.3}px) ` +
      `rotate(${swipeOffset.x * 0.01}deg)`
    : 'translate(0, 0)'

  // Get rating and color for swipe indicator
  const swipeRating = swipeDirection ? getRatingFromSwipe(swipeDirection) : null
  const swipeColorClass = swipeRating
    ? getRatingColor(swipeRating)
    : 'text-muted-foreground'

  return {
    // Event handlers
    handlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave: onMouseUp,
      onTouchStart,
      onTouchMove,
      onTouchEnd
    },
    // Swipe state
    swipeDirection,
    swipeOffset,
    swipeDistance,
    swipeRating,
    swipeColorClass,
    // Visual state
    transform,
    isAnimating,
    // Refs for external use (e.g., click prevention)
    isDragging,
    hasSwiped,
    // Constants
    threshold
  }
}
