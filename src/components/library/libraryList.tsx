'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Check, Play, Circle } from 'lucide-react'
import { LibraryDeck } from '@/lib/series/libraryData'
import { Card, CardContent } from '@/components/ui/card'

interface LibraryListProps {
  decks: LibraryDeck[]
}

interface StatusIndicatorProps {
  dueNow: number
  completed: boolean
  isInProgress: boolean
  isNew: boolean
}

/**
 * Status indicator block showing deck urgency/state.
 * Input: due count, completion state, progress flags
 * Output: Colored block with icon/count
 */
function StatusIndicator({
  dueNow,
  completed,
  isInProgress,
  isNew
}: StatusIndicatorProps) {
  // Priority: Due Now > Completed > In Progress > New
  if (dueNow > 0) {
    return (
      <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-brand-red
                      flex flex-col items-center justify-center text-white">
        <span className="text-base font-bold">{dueNow}</span>
        <span className="text-[9px] uppercase tracking-wide">due</span>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-brand-green
                      flex items-center justify-center text-white">
        <Check className="w-5 h-5" />
      </div>
    )
  }

  if (isInProgress) {
    return (
      <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-accent
                      flex items-center justify-center text-accent-foreground">
        <Play className="w-4 h-4 fill-current" />
      </div>
    )
  }

  // New deck
  return (
    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted
                    flex flex-col items-center justify-center
                    text-muted-foreground">
      <Circle className="w-4 h-4" />
      <span className="text-[9px] uppercase tracking-wide mt-0.5">new</span>
    </div>
  )
}

/**
 * Displays library decks in a vertical list layout with status inbox pattern.
 * Input: library deck array
 * Output: List layout component
 */
export function LibraryList({ decks }: LibraryListProps) {
  return (
    <div className="space-y-3">
      {decks.map((deck, index) => {
        const { chapter, series, progress } = deck
        const isCompleted = progress.completed === true
        const isInProgress = !isCompleted && progress.num_cards_studied > 0
        const isNew = progress.num_cards_studied === 0
        const progressPercent = progress.total_cards
          ? Math.round((progress.num_cards_studied / progress.total_cards) * 100)
          : 0

        return (
          <motion.div
            key={`${series.id}-${chapter.id}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Link href={`/study/${series.slug}/${chapter.chapter_number}`}>
              <Card className="transition-all hover:shadow-md cursor-pointer
                              hover:bg-card/50">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex gap-4">
                    {/* Status Indicator */}
                    <StatusIndicator
                      dueNow={deck.dueNow}
                      completed={isCompleted}
                      isInProgress={isInProgress}
                      isNew={isNew}
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      {/* Header: Series + Chapter */}
                      <div className="flex items-baseline gap-2 mb-1">
                        <span
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            window.location.href = `/browse/${series.slug}`
                          }}
                          className="text-sm font-medium text-foreground
                                   hover:text-primary hover:underline
                                   transition-colors truncate cursor-pointer"
                        >
                          {series.name}
                        </span>
                        <span className="text-muted-foreground flex-shrink-0">
                          ·
                        </span>
                        <span className="text-sm text-muted-foreground
                                       flex-shrink-0">
                          Ch. {chapter.chapter_number}
                        </span>
                      </div>

                      {/* Progress Summary */}
                      <div className="text-sm text-muted-foreground mb-2">
                        {progress.num_cards_studied}/{progress.total_cards}{' '}
                        studied
                        {deck.dueLaterToday > 0 && (
                          <span> · {deck.dueLaterToday} due later</span>
                        )}
                      </div>

                      {/* Progress Bar */}
                      {progress.total_cards && progress.total_cards > 0 && (
                        <div className="w-full h-1.5 bg-muted rounded-full
                                      overflow-hidden">
                          <div
                            className="h-full bg-accent transition-all"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        )
      })}
    </div>
  )
}
