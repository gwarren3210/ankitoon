"use client"

import { useRef } from 'react'
import { StudyCard } from '@/lib/study/types'
import { FsrsRating } from '@/lib/study/fsrs'
import { useSwipeGestures } from '@/lib/hooks/useSwipeGestures'
import { useFlipCard } from '@/lib/hooks/useFlipCard'

interface FlashcardProps {
  card: StudyCard
  onRate: (rating: FsrsRating) => void
  isRevealed: boolean
  onRevealedChange: (revealed: boolean) => void
  hasBeenRevealed: boolean
}

const SWIPE_THRESHOLD = 50

/**
 * Interactive flashcard component with flip animation and swipe gestures.
 * Input: card data, rating callback, reveal state
 * Output: Animated flashcard with term/definition flip
 */
export function Flashcard({
  card,
  onRate,
  isRevealed,
  onRevealedChange,
  hasBeenRevealed
}: FlashcardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  // Swipe gesture handling
  const {
    handlers,
    swipeDirection,
    swipeDistance,
    swipeColorClass,
    transform,
    isAnimating,
    isDragging,
    hasSwiped,
    threshold
  } = useSwipeGestures({
    threshold: SWIPE_THRESHOLD,
    onSwipe: onRate,
    enabled: hasBeenRevealed
  })

  // Flip card handling (spacebar + click)
  const { handleCardClick } = useFlipCard({
    isRevealed,
    onRevealedChange,
    isDragging,
    hasSwiped
  })

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px]
                    sm:min-h-[400px] px-4">

      {/* Flashcard */}
      <div
        ref={cardRef}
        className={`
          relative w-full max-w-md h-56 sm:h-64 cursor-pointer select-none
          transition-all duration-200 ease-out
          ${isAnimating ? 'animate-fade-out' : ''}
        `}
        style={{ transform }}
        onClick={handleCardClick}
        {...handlers}
      >
        <div className={`
          absolute inset-0 rounded-lg border-2 border-border bg-card
          shadow-lg transition-all duration-300 ease-in-out
          ${isRevealed ? 'shadow-xl' : 'shadow-md'}
          hover:shadow-xl
        `}>
          {/* Card Content */}
          <div className="flex flex-col items-center justify-center h-full
                          p-6 text-center">
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
                {(card.chapterExample || card.globalExample) && (
                  <div className="space-y-2 text-sm">
                    {card.chapterExample && (
                      <div className="italic text-muted-foreground">
                        <span className="font-medium">Chapter:</span>{' '}
                        &quot;{card.chapterExample}&quot;
                      </div>
                    )}
                    {card.globalExample && (
                      <div className="italic text-muted-foreground">
                        <span className="font-medium">Example:</span>{' '}
                        &quot;{card.globalExample}&quot;
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Swipe indicator with progress */}
          {swipeDirection && hasBeenRevealed && (
            <div className="absolute top-4 left-4 pointer-events-none">
              <div className="relative w-16 h-16">
                {/* Background circle */}
                <svg
                  className="w-16 h-16 transform -rotate-90"
                  viewBox="0 0 64 64"
                >
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
                    strokeDashoffset={`${2 * Math.PI * 28 *
                      (1 - Math.min(swipeDistance / threshold, 1))}`}
                    className={`transition-all duration-100 ${swipeColorClass}`}
                  />
                </svg>
                {/* Icon in center */}
                <div className={`
                  absolute inset-0 flex items-center justify-center
                  text-2xl font-bold ${swipeColorClass}
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
