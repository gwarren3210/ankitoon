"use client"

import { useRef } from 'react'
import { motion, useSpring, useReducedMotion } from 'framer-motion'
import { StudyCard, CardType } from '@/lib/study/types'
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
 * Interactive 3D flashcard component with flip animation and swipe gestures.
 * Input: card data, rating callback, reveal state
 * Output: Animated 3D flashcard with term/definition flip
 */
export function Flashcard({
  card,
  onRate,
  isRevealed,
  onRevealedChange,
  hasBeenRevealed
}: FlashcardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()

  // Spring physics for smooth 3D rotation
  const rotateY = useSpring(isRevealed ? 180 : 0, {
    stiffness: 300,
    damping: 30,
    mass: 1
  })

  // Update rotation when reveal state changes
  if (prefersReducedMotion) {
    rotateY.jump(isRevealed ? 180 : 0)
  } else {
    rotateY.set(isRevealed ? 180 : 0)
  }

  // Swipe gesture handling
  const {
    handlers,
    swipeDirection,
    swipeDistance,
    swipeColorClass,
    transform: swipeTransform,
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

      {/* Outer container: handles swipe transforms */}
      <div
        ref={cardRef}
        className={`
          relative w-full max-w-md h-56 sm:h-64 cursor-pointer select-none
          perspective-1000
          ${isAnimating ? 'animate-fade-out' : ''}
        `}
        style={{ transform: swipeTransform }}
        onClick={handleCardClick}
        {...handlers}
      >
        {/* Inner container: handles 3D flip rotation */}
        <motion.div
          className="relative w-full h-full preserve-3d will-change-transform"
          style={{ rotateY }}
        >
          {/* Front Face - Korean Term */}
          <div
            className="absolute inset-0 rounded-lg border-2 border-border bg-card
                       shadow-lg backface-hidden"
          >
            {/* Card Type Badge */}
            <CardTypeBadge cardType={card.cardType} />

            <div className="flex flex-col items-center justify-center h-full
                            p-6 text-center">
              <div className="space-y-4">
                <div className="text-3xl font-bold text-primary font-korean">
                  {card.term}
                </div>
                <div className="text-sm text-muted-foreground">
                  Tap or press Space to reveal
                </div>
              </div>
            </div>
          </div>

          {/* Back Face - English Definition */}
          <div
            className="absolute inset-0 rounded-lg border-2 border-border bg-card
                       shadow-xl backface-hidden rotate-y-180"
          >
            {/* Card Type Badge (mirrored for back face) */}
            <CardTypeBadge cardType={card.cardType} mirrored />

            <div className="flex flex-col items-center justify-center h-full
                            p-6 text-center">
              <div className="space-y-4">
                <div className="text-xl font-medium text-foreground font-comic">
                  {card.definition}
                </div>
                {card.displayExample && (
                  <div className="text-sm text-muted-foreground font-korean-light">
                    &quot;{card.displayExample}&quot;
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Swipe Indicator Overlay */}
        {swipeDirection && hasBeenRevealed && (
          <SwipeIndicator
            direction={swipeDirection}
            distance={swipeDistance}
            threshold={threshold}
            colorClass={swipeColorClass}
          />
        )}
      </div>
    </div>
  )
}

interface SwipeIndicatorProps {
  direction: 'left' | 'right' | 'up' | 'down'
  distance: number
  threshold: number
  colorClass: string
}

/**
 * Swipe indicator with progress circle.
 * Input: swipe direction, distance, threshold, color
 * Output: SVG circular progress indicator with icon
 */
function SwipeIndicator({
  direction,
  distance,
  threshold,
  colorClass
}: SwipeIndicatorProps) {
  const progress = Math.min(distance / threshold, 1)
  const circumference = 2 * Math.PI * 28

  return (
    <div className="absolute top-4 left-4 pointer-events-none z-10">
      <div className="relative w-16 h-16">
        <svg
          className="w-16 h-16 transform -rotate-90"
          viewBox="0 0 64 64"
        >
          {/* Background circle */}
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
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            className={`transition-all duration-100 ${colorClass}`}
          />
        </svg>
        {/* Icon in center */}
        <div className={`
          absolute inset-0 flex items-center justify-center
          text-2xl font-bold ${colorClass}
        `}>
          {(direction === 'left' || direction === 'down') && '✗'}
          {(direction === 'right' || direction === 'up') && '✓'}
        </div>
      </div>
    </div>
  )
}

interface CardTypeBadgeProps {
  cardType: CardType
  mirrored?: boolean
}

/**
 * Badge indicating whether card is vocabulary or grammar.
 * Input: card type, whether badge should be mirrored (for back face)
 * Output: Small colored badge in top-right corner
 */
function CardTypeBadge({ cardType, mirrored = false }: CardTypeBadgeProps) {
  const isGrammar = cardType === 'grammar'

  return (
    <div
      className={`
        absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-medium
        ${isGrammar
          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
        }
        ${mirrored ? 'scale-x-[-1]' : ''}
      `}
    >
      <span className={mirrored ? 'scale-x-[-1] inline-block' : ''}>
        {isGrammar ? 'Grammar' : 'Vocab'}
      </span>
    </div>
  )
}
