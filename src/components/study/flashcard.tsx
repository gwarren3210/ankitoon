"use client"

import { useState, useRef, useEffect } from 'react'
import { StudyCard } from '@/lib/study/studyData'
import { FsrsRating } from '@/lib/study/fsrs'

interface FlashcardProps {
  card: StudyCard
  onRate: (rating: FsrsRating) => void
  isRevealed?: boolean
  onFlip?: () => void
}

// why is this nullable?
type SwipeDirection = 'left' | 'right' | 'up' | 'down' | null

/**
 * Interactive flashcard component with flip animation and swipe gestures.
 * Input: card data, rating callback, reveal state
 * Output: Animated flashcard with term/definition flip
 * TODO: enable keyboard navigation and buttons to rate the card
 */
export function Flashcard({ card, onRate, isRevealed = false, onFlip }: FlashcardProps) {
  const [revealed, setRevealed] = useState(isRevealed)
  const [isAnimating, setIsAnimating] = useState(false)
  const [swipeDirection, setSwipeDirection] = useState<SwipeDirection>(null)
  const [swipeOffset, setSwipeOffset] = useState({ x: 0, y: 0 })

  const cardRef = useRef<HTMLDivElement>(null)
  const startPos = useRef({ x: 0, y: 0 })
  const isDragging = useRef(false)

  // Reset revealed state when card changes
  // TODO: why is this not using the srsCard id?
  useEffect(() => {
    setRevealed(false)
  }, [card.vocabulary.id, isRevealed])

  // Handle space bar to flip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault()
        setRevealed(prev => {
          const newRevealed = !prev
          if (onFlip) {
            onFlip()
          }
          return newRevealed
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onFlip])

  // Handle card click/tap to flip
  const handleCardClick = () => {
    if (!isDragging.current) {
      setRevealed(!revealed)
      if (onFlip) {
        onFlip()
      }
    }
  }

  // Touch/mouse event handlers for swipe gestures
  const handleStart = (clientX: number, clientY: number) => {
    startPos.current = { x: clientX, y: clientY }
    isDragging.current = false
  }

  const handleMove = (clientX: number, clientY: number) => {
    if (!startPos.current.x && !startPos.current.y) return

    const deltaX = clientX - startPos.current.x
    const deltaY = clientY - startPos.current.y
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    // Start dragging if moved more than 10px
    if (distance > 10) {
      isDragging.current = true
      setSwipeOffset({ x: deltaX, y: deltaY })

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

  const handleEnd = () => {
    if (!isDragging.current) return

    const { x, y } = swipeOffset
    const distance = Math.sqrt(x * x + y * y)

    // Minimum swipe distance to trigger rating
    if (distance > 100) {
      let rating: 1 | 2 | 3 | 4

      if (Math.abs(x) > Math.abs(y)) {
        // Horizontal swipe
        rating = x > 0 ? 3 : 1 // Right = Good, Left = Again
      } else {
        // Vertical swipe
        rating = y > 0 ? 2 : 4 // Down = Hard, Up = Easy
      }

      setIsAnimating(true)
      setTimeout(() => onRate(rating), 200)
    }

    // Reset state
    setSwipeOffset({ x: 0, y: 0 })
    setSwipeDirection(null)
    isDragging.current = false
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
      {/* Swipe hint */}
      <div className="text-xs text-muted-foreground mb-4 text-center">
        Tap to reveal • Swipe to rate
      </div>

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
          ${revealed ? 'shadow-xl' : 'shadow-md'}
          hover:shadow-xl
        `}>
          {/* Card Content */}
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            {!revealed ? (
              // Front side - Korean term
              <div className="space-y-4">
                <div className="text-3xl font-bold text-primary">
                  {card.vocabulary.term}
                </div>
                <div className="text-sm text-muted-foreground">
                  Click or tap to reveal answer
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
                    "{card.vocabulary.example}"
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Swipe to rate your recall
                </div>
              </div>
            )}
          </div>

          {/* Swipe indicator */}
          {swipeDirection && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={`
                text-2xl font-bold rounded-full w-16 h-16 flex items-center justify-center
                ${swipeDirection === 'left' ? 'bg-red-500 text-white' :
                  swipeDirection === 'right' ? 'bg-green-500 text-white' :
                  swipeDirection === 'up' ? 'bg-blue-500 text-white' :
                  'bg-orange-500 text-white'}
              `}>
                {swipeDirection === 'left' && '✗'}
                {swipeDirection === 'right' && '✓'}
                {swipeDirection === 'up' && '✓'}
                {swipeDirection === 'down' && '✗'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rating hints */}
      {revealed && (
        <div className="mt-6 grid grid-cols-2 gap-4 text-xs text-muted-foreground max-w-sm">
          <div className="text-center">
            <div className="font-medium text-red-600">← Swipe Left</div>
            <div>Again (Forgot)</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-blue-600">Swipe Right →</div>
            <div>Good</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-orange-600">↓ Swipe Down</div>
            <div>Hard</div>
          </div>
          <div className="text-center">
            <div className="font-medium text-green-600">↑ Swipe Up</div>
            <div>Easy</div>
          </div>
        </div>
      )}
    </div>
  )
}
