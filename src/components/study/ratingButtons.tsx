"use client"

import { Button } from '@/components/ui/button'
import { FsrsCard, FsrsRating, getIntervalPreviews } from '@/lib/study/fsrs'

interface RatingButtonsProps {
  card: FsrsCard
  onRate: (rating: FsrsRating) => void
  disabled?: boolean
}

/**
 * Rating buttons component showing FSRS interval previews.
 * Input: current card state, rating callback, disabled state
 * Output: Four rating buttons with next review interval previews
 */
export function RatingButtons({ card, onRate, disabled = false }: RatingButtonsProps) {
  const intervalPreviews = getIntervalPreviews(card)

  const ratingOptions = [
    {
      rating: FsrsRating.Again,
      label: 'Again',
      description: 'Forgot completely',
      color: 'bg-red-500 hover:bg-red-600',
      interval: intervalPreviews[FsrsRating.Again]
    },
    {
      rating: FsrsRating.Hard,
      label: 'Hard',
      description: 'Struggled to recall',
      color: 'bg-orange-500 hover:bg-orange-600',
      interval: intervalPreviews[FsrsRating.Hard]
    },
    {
      rating: FsrsRating.Good,
      label: 'Good',
      description: 'Recalled with effort',
      color: 'bg-blue-500 hover:bg-blue-600',
      interval: intervalPreviews[FsrsRating.Good]
    },
    {
      rating: FsrsRating.Easy,
      label: 'Easy',
      description: 'Recalled easily',
      color: 'bg-green-500 hover:bg-green-600',
      interval: intervalPreviews[FsrsRating.Easy]
    }
  ]

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          How well did you remember this card?
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {ratingOptions.map((option) => (
          <Button
            key={option.rating}
            onClick={() => onRate(option.rating)}
            disabled={disabled}
            className={`
              h-auto p-4 flex flex-col items-center gap-1 text-white font-medium
              transition-all duration-200 transform hover:scale-105 active:scale-95
              ${option.color}
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <span className="text-lg">{option.label}</span>
            <span className="text-xs opacity-90">{option.description}</span>
            <span className="text-xs opacity-75 font-normal">
              Next: {option.interval}
            </span>
          </Button>
        ))}
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
