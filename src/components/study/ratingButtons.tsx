"use client"

import { motion, useReducedMotion } from 'framer-motion'
import { FsrsCard, FsrsRating, getIntervalPreviews } from '@/lib/study/fsrs'

interface RatingButtonsProps {
  card: FsrsCard
  onRate: (rating: FsrsRating) => void
  disabled?: boolean
  isRevealed?: boolean
  lastRating?: FsrsRating | null
}

const buttonVariants = {
  idle: { scale: 1, opacity: 1 },
  hover: { scale: 1.05 },
  tap: { scale: 0.95 }
}

const springTransition = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 17
}

/**
 * Rating buttons component with spring physics animations.
 * Input: current card state, rating callback, disabled state, reveal state
 * Output: Four animated rating buttons with FSRS interval previews
 */
export function RatingButtons({
  card,
  onRate,
  disabled = false,
  isRevealed = false
}: RatingButtonsProps) {
  const prefersReducedMotion = useReducedMotion()
  const intervalPreviews = getIntervalPreviews(card)
  const isDisabled = disabled || !isRevealed

  const ratingOptions = [
    {
      rating: FsrsRating.Again,
      label: 'Again',
      activeColor: 'bg-brand-red hover:bg-brand-red/90',
      mutedColor: 'bg-brand-red/40',
      interval: intervalPreviews[FsrsRating.Again],
      keyboardShortcut: '1 or ←'
    },
    {
      rating: FsrsRating.Hard,
      label: 'Hard',
      activeColor: 'bg-brand-orange hover:bg-brand-orange/90',
      mutedColor: 'bg-brand-orange/40',
      interval: intervalPreviews[FsrsRating.Hard],
      keyboardShortcut: '2 or ↓'
    },
    {
      rating: FsrsRating.Good,
      label: 'Good',
      activeColor: 'bg-accent hover:bg-accent/90',
      mutedColor: 'bg-accent/40',
      interval: intervalPreviews[FsrsRating.Good],
      keyboardShortcut: '3 or →'
    },
    {
      rating: FsrsRating.Easy,
      label: 'Easy',
      activeColor: 'bg-brand-green hover:bg-brand-green/90',
      mutedColor: 'bg-brand-green/40',
      interval: intervalPreviews[FsrsRating.Easy],
      keyboardShortcut: '4 or ↑'
    }
  ]

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          How well did you remember this card?
        </h3>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-2">
        {ratingOptions.map((option, index) => {
          const buttonClasses = isDisabled
            ? `${option.mutedColor} text-muted-foreground cursor-not-allowed`
            : `${option.activeColor} text-white cursor-pointer`

          return (
            <motion.button
              key={option.rating}
              onClick={() => !isDisabled && onRate(option.rating)}
              disabled={isDisabled}
              variants={prefersReducedMotion ? undefined : buttonVariants}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 1 }}
              animate={prefersReducedMotion ? false : { opacity: 1, y: 0, scale: 1 }}
              whileHover={isDisabled || prefersReducedMotion ? undefined : 'hover'}
              whileTap={isDisabled || prefersReducedMotion ? undefined : 'tap'}
              transition={
                prefersReducedMotion
                  ? undefined
                  : { ...springTransition, delay: index * 0.05 }
              }
              className={`
                h-auto min-h-[64px] sm:min-h-[80px] p-3 sm:p-3
                flex flex-col items-center gap-1 sm:gap-1
                font-medium rounded-md
                ${buttonClasses}
                focus:outline-none focus-visible:ring-2
                focus-visible:ring-offset-2 focus-visible:ring-ring
              `}
            >
              <span className="text-[9px] sm:text-xs opacity-80 leading-tight
                              font-normal">
                {option.keyboardShortcut}
              </span>
              <span className="text-xs sm:text-base leading-tight font-semibold">
                {option.label}
              </span>
              <span className="text-[8px] sm:text-xs opacity-75 font-normal
                              leading-tight">
                {option.interval}
              </span>
            </motion.button>
          )
        })}
      </div>

      <div className="mt-4 text-center">
        <p className="text-xs text-muted-foreground">
          Choose the option that best describes your recall experience
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Keyboard: ← ↓ → ↑ or 1-4 • Space or tap to flip
        </p>
      </div>
    </div>
  )
}
