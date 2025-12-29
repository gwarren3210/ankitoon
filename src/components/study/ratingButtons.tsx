"use client"

import { Button } from '@/components/ui/button'
import { FsrsCard, FsrsRating, getIntervalPreviews } from '@/lib/study/fsrs'

interface RatingButtonsProps {
  card: FsrsCard
  onRate: (rating: FsrsRating) => void
  disabled?: boolean
  isRevealed?: boolean
  lastRating?: FsrsRating | null
}

/**
 * Rating buttons component showing FSRS interval previews.
 * Input: current card state, rating callback, disabled state, reveal state, last rating
 * Output: Four rating buttons with next review interval previews
 */
export function RatingButtons({ 
  card, 
  onRate, 
  disabled = false,
  isRevealed = false,
  lastRating = null
}: RatingButtonsProps) {
  const intervalPreviews = getIntervalPreviews(card)

  const ratingOptions = [
    {
      rating: FsrsRating.Again,
      label: 'Again',
      description: 'Forgot completely',
      color: 'bg-red-500 hover:bg-red-600',
      interval: intervalPreviews[FsrsRating.Again],
      keyboardShortcut: '1 or ←'
    },
    {
      rating: FsrsRating.Hard,
      label: 'Hard',
      description: 'Struggled to recall',
      color: 'bg-orange-500 hover:bg-orange-600',
      interval: intervalPreviews[FsrsRating.Hard],
      keyboardShortcut: '2 or ↓'
    },
    {
      rating: FsrsRating.Good,
      label: 'Good',
      description: 'Recalled with some effort',
      color: 'bg-blue-500 hover:bg-blue-600',
      interval: intervalPreviews[FsrsRating.Good],
      keyboardShortcut: '3 or →'
    },
    {
      rating: FsrsRating.Easy,
      label: 'Easy',
      description: 'Recalled without effort',
      color: 'bg-green-500 hover:bg-green-600',
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

      <div className="grid grid-cols-4 gap-1 sm:gap-2">
        {ratingOptions.map((option) => {
          const isDisabled = disabled || !isRevealed
          const isLastUsed = lastRating === option.rating
          return (
            <Button
              key={option.rating}
              onClick={() => onRate(option.rating)}
              disabled={isDisabled}
              className={`
                h-auto p-2 sm:p-3 flex flex-col items-center gap-0.5 sm:gap-1
                text-white font-medium transition-all duration-200 transform
                hover:scale-105 active:scale-95 ${option.color}
                ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                ${isLastUsed ? 'ring-2 ring-offset-2 ring-white' : ''}
              `}
            >
              <span className="text-[10px] sm:text-xs opacity-80 leading-tight font-normal">
                {option.keyboardShortcut}
              </span>
              <span className="text-xs sm:text-base leading-tight font-semibold">
                {option.label}
              </span>
              <span className="text-[9px] sm:text-xs opacity-75 font-normal leading-tight">
                {option.interval}
              </span>
            </Button>
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
