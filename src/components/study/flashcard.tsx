"use client"

import { useState, useRef, useEffect } from 'react'
import { StudyCard } from '@/lib/study/types'
import { FsrsRating } from '@/lib/study/fsrs'

interface FlashcardProps {
  card: StudyCard
  onRate: (rating: FsrsRating) => void
  isRevealed: boolean
  onRevealedChange: (revealed: boolean) => void
  hasBeenRevealed: boolean
}

// why is this nullable?
type SwipeDirection = 'left' | 'right' | 'up' | 'down' | null

/**
 * Interactive flashcard component with flip animation and swipe gestures.
 * Input: card data, rating callback, reveal state
 * Output: Animated flashcard with term/definition flip
 * TODO: enable keyboard navigation and buttons to rate the card
 */
const SWIPE_THRESHOLD = 100

export function Flashcard({ card, onRate, isRevealed, onRevealedChange, hasBeenRevealed }: FlashcardProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [swipeDirection, setSwipeDirection] = useState<SwipeDirection>(null)
  const [swipeOffset, setSwipeOffset] = useState({ x: 0, y: 0 })
  const [swipeDistance, setSwipeDistance] = useState(0)

  const cardRef = useRef<HTMLDivElement>(null)
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

  // Handle space bar to flip
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

  // Handle card click/tap to flip
  // Allow flipping back and forth, but only if no swipe gesture occurred
  const handleCardClick = () => {
    if (!isDragging.current && !hasSwiped.current) {
      onRevealedChange(!isRevealed)
    }
  }

  // Touch/mouse event handlers for swipe gestures
  const handleStart = (clientX: number, clientY: number) => {
    startPos.current = { x: clientX, y: clientY }
    isDragging.current = false
    hasSwiped.current = false
  }

  const handleMove = (clientX: number, clientY: number) => {
    if (!startPos.current) return

    const deltaX = clientX - startPos.current.x
    const deltaY = clientY - startPos.current.y
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    // Start dragging if moved more than 10px
    // Only show swipe indicators when buttons are active (hasBeenRevealed)
    if (distance > 10) {
      isDragging.current = true
      hasSwiped.current = true
      // Only apply swipe offset when buttons are active
      if (hasBeenRevealed) {
        setSwipeOffset({ x: deltaX, y: deltaY })
        setSwipeDistance(distance)

        // Determine swipe direction
        // TODO: gotta be more generous with the thresholds for the swipe direction
        // TODO: also consider using a more robust algorithm for the swipe direction
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          setSwipeDirection(deltaX > 0 ? 'right' : 'left')
        } else {
          setSwipeDirection(deltaY > 0 ? 'down' : 'up')
        }
      }
    }
  }

  const handleEnd = () => {
    if (!isDragging.current) return

    const { x, y } = swipeOffset
    const distance = Math.sqrt(x * x + y * y)

    // Only allow swipe-to-rate when buttons are active (hasBeenRevealed)
    if (hasBeenRevealed && distance > SWIPE_THRESHOLD && isMountedRef.current) {
      let rating: 1 | 2 | 3 | 4

      if (Math.abs(x) > Math.abs(y)) {
        // Horizontal swipe
        rating = x > 0 ? 3 : 1 // Right = Good, Left = Again
      } else {
        // Vertical swipe
        rating = y > 0 ? 2 : 4 // Down = Hard, Up = Easy
      }

      setIsAnimating(true)
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      // Set new timeout with cleanup check
      timeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          onRate(rating)
        }
        timeoutRef.current = null
      }, 200)
    }

    // Reset state
    setSwipeOffset({ x: 0, y: 0 })
    setSwipeDistance(0)
    setSwipeDirection(null)
    isDragging.current = false
    startPos.current = null
  }

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    handleStart(touch.clientX, touch.clientY)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      handleMove(touch.clientX, touch.clientY)
    }
  }

  const handleTouchEnd = () => {
    handleEnd()
  }

  // Mouse event handlers (for desktop testing)
  const handleMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX, e.clientY)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (e.buttons === 1) { // Left mouse button
      handleMove(e.clientX, e.clientY)
    }
  }

  const handleMouseUp = () => {
    handleEnd()
  }

  // Calculate transform based on swipe
  const transform = swipeOffset.x !== 0 || swipeOffset.y !== 0
    ? `translate(${swipeOffset.x * 0.3}px, ${swipeOffset.y * 0.3}px) rotate(${swipeOffset.x * 0.01}deg)`
    : 'translate(0, 0)'

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] px-4">

      {/* Flashcard */}
      <div
        ref={cardRef}
        className={`
          relative w-full max-w-md h-64 cursor-pointer select-none
          transition-all duration-200 ease-out
          ${isAnimating ? 'animate-fade-out' : ''}
        `}
        style={{ transform }}
        onClick={handleCardClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className={`
          absolute inset-0 rounded-lg border-2 border-border bg-card
          shadow-lg transition-all duration-300 ease-in-out
          ${isRevealed ? 'shadow-xl' : 'shadow-md'}
          hover:shadow-xl
        `}>
          {/* Card Content */}
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            {!isRevealed ? (
              // Front side - Korean term
              <div className="space-y-4">
                <div className="text-3xl font-bold text-primary">
                  {card.vocabulary.term}
                </div>
              </div>
            ) : (
              // Back side - English definition
              <div className="space-y-4">
                <div className="text-xl font-medium text-foreground">
                  {card.vocabulary.definition}
                </div>
                {card.vocabulary.example && (
                  <div className="text-sm italic text-muted-foreground">
                    &quot;{card.vocabulary.example}&quot;
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Swipe indicator with progress */}
          {swipeDirection && hasBeenRevealed && (
            <div className="absolute bottom-4 right-4 pointer-events-none">
              <div className="relative w-16 h-16">
                {/* Background circle */}
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="text-white/20"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 28}`}
                    strokeDashoffset={`${2 * Math.PI * 28 * (1 - Math.min(swipeDistance / SWIPE_THRESHOLD, 1))}`}
                    className={`
                      transition-all duration-100
                      ${swipeDirection === 'left' ? 'text-red-500' :
                        swipeDirection === 'right' ? 'text-green-500' :
                        swipeDirection === 'up' ? 'text-blue-500' :
                        'text-orange-500'}
                    `}
                  />
                </svg>
                {/* Icon in center */}
                <div className={`
                  absolute inset-0 flex items-center justify-center
                  text-2xl font-bold
                  ${swipeDirection === 'left' ? 'text-red-500' :
                    swipeDirection === 'right' ? 'text-green-500' :
                    swipeDirection === 'up' ? 'text-blue-500' :
                    'text-orange-500'}
                `}>
                  {swipeDirection === 'left' && '✗'}
                  {swipeDirection === 'right' && '✓'}
                  {swipeDirection === 'up' && '✓'}
                  {swipeDirection === 'down' && '✗'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
