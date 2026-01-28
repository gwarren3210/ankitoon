'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { LibraryDeck } from '@/lib/series/libraryData'
import { cn } from '@/lib/utils'

interface DeckCardProps {
  deck: LibraryDeck
}

/**
 * Determines the left border color based on deck status.
 * Input: due count, completion state, progress percent
 * Output: Tailwind border color class
 */
function getStatusBorderColor(
  dueNow: number,
  completed: boolean,
  progressPercent: number
): string {
  if (dueNow > 0) return 'border-l-brand-red'
  if (completed) return 'border-l-brand-green'
  if (progressPercent > 0) return 'border-l-accent'
  return 'border-l-muted'
}

/**
 * Displays a single chapter/deck entry card with status inbox pattern.
 * Input: library deck entry
 * Output: Deck card component with status indicator linking to study page
 */
export function DeckCard({ deck }: DeckCardProps) {
  const router = useRouter()
  const { chapter, series, progress } = deck
  const isCompleted = progress.completed === true
  const progressPercent = progress.total_cards
    ? Math.round((progress.num_cards_studied / progress.total_cards) * 100)
    : 0

  const handleCardClick = () => {
    router.push(`/study/${series.slug}/${chapter.chapter_number}`)
  }

  return (
    <Card
      className="h-full transition-all hover:shadow-md
                  hover:bg-card/50 cursor-pointer group"
      onClick={handleCardClick}
    >
      <CardContent
        className={cn(
          'px-3.5 sm:px-4 border-l-[6px]',
          getStatusBorderColor(deck.dueNow, isCompleted, progressPercent)
        )}
      >
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {/* Header: Series + Chapter */}
          <div className="flex items-baseline gap-2 mb-1.5">
            <Link
              href={`/browse/${series.slug}`}
              onClick={(e) => e.stopPropagation()}
              className="text-base font-semibold text-foreground
                       hover:text-primary hover:underline
                       transition-colors truncate"
            >
              {series.name}
            </Link>
            <span className="text-muted-foreground flex-shrink-0">·</span>
            <span className="text-sm text-muted-foreground flex-shrink-0">
              Ch. {chapter.chapter_number}
            </span>
          </div>

          {/* Progress Summary with inline due count */}
          <div className="text-sm text-foreground/60 mb-2">
            {progress.num_cards_studied}/{progress.total_cards} studied
            {deck.dueNow > 0 && <span> · {deck.dueNow} due now</span>}
            {deck.dueLaterToday > 0 && (
              <span> · {deck.dueLaterToday} due later</span>
            )}
          </div>

          {/* Progress Bar */}
          {progress.total_cards && progress.total_cards > 0 && (
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
