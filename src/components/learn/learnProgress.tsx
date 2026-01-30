'use client'

import { Progress } from '@/components/ui/progress'
import { LearnProgress as LearnProgressType } from '@/lib/study/types'

interface LearnProgressProps {
  progress: LearnProgressType
}

/**
 * Progress display for learn phase.
 * Shows graduated cards count, progress bar, and current card status.
 * Input: progress state from useLearnPhase
 * Output: Progress UI with bar and text indicators
 */
export function LearnProgress({ progress }: LearnProgressProps) {
  const { graduated, total, currentCorrect, requiredCorrect } = progress
  const percentage = total > 0 ? Math.round((graduated / total) * 100) : 0

  return (
    <div className="w-full max-w-lg mx-auto px-4 space-y-3 mb-6">
      {/* Main progress text */}
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>
          Learning: {graduated} of {total}
        </span>
        <span>{percentage}% complete</span>
      </div>

      {/* Progress bar */}
      <Progress
        value={percentage}
        className="h-2 dark:[&_[data-slot=progress-indicator]]:bg-accent
                   dark:[&_[data-slot=progress]]:bg-accent/20"
      />

      {/* Current card progress indicator */}
      <div className="flex justify-center">
        <div className="flex items-center gap-2">
          {Array.from({ length: requiredCorrect }).map((_, i) => (
            <div
              key={i}
              className={`
                w-3 h-3 rounded-full transition-colors duration-300
                ${
                  i < currentCorrect
                    ? 'bg-green-500'
                    : 'bg-muted border border-border'
                }
              `}
            />
          ))}
          <span className="text-xs text-muted-foreground ml-1">
            {currentCorrect}/{requiredCorrect} correct
          </span>
        </div>
      </div>
    </div>
  )
}
