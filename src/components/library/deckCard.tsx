'use client'

import Link from 'next/link'
import { Tables } from '@/types/database.types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LibraryDeck } from '@/lib/series/libraryData'

interface DeckCardProps {
  deck: LibraryDeck
}

/**
 * Displays a single chapter/deck entry card with series context.
 * Input: library deck entry
 * Output: Deck card component linking to study page
 */
export function DeckCard({ deck }: DeckCardProps) {
  const { chapter, series, progress } = deck
  const isCompleted = progress.completed === true
  const isInProgress = !isCompleted && progress.num_cards_studied > 0
  const isNew = progress.num_cards_studied === 0 || progress.num_cards_studied < 5
  const progressPercent = progress.total_cards
    ? Math.round((progress.num_cards_studied / progress.total_cards) * 100)
    : 0

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <Link href={`/study/${series.slug}/${chapter.chapter_number}`}>
      <Card className="h-full transition-all hover:shadow-md 
                      hover:bg-muted/50 cursor-pointer group">
        <CardContent className="px-6">
          <div className="flex flex-col h-full space-y-3">
            {/* Series Name */}
            <Link
              href={`/browse/${series.slug}`}
              onClick={(e) => e.stopPropagation()}
              className="inline w-fit text-sm font-medium text-foreground 
                       hover:text-primary hover:underline 
                       transition-colors"
            >
              {series.name}
            </Link>

            {/* Chapter Info */}
            <div>
              <h3 className="font-semibold text-lg text-muted-foreground">
                Chapter {chapter.chapter_number}
              </h3>
            </div>

            {/* Progress Info */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Cards studied
                </span>
                <span className="font-medium">
                  {progress.num_cards_studied}
                  {progress.total_cards && (
                    <> / {progress.total_cards}</>
                  )}
                </span>
              </div>

              {/* Due Cards */}
              {(deck.dueNow > 0 || deck.dueLaterToday > 0) && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {deck.dueNow > 0 && (
                    <span>
                      <span className="font-medium text-foreground">
                        {deck.dueNow}
                      </span>{' '}
                      due now
                    </span>
                  )}
                  {deck.dueLaterToday > 0 && (
                    <span>
                      <span className="font-medium text-foreground">
                        {deck.dueLaterToday}
                      </span>{' '}
                      due later today
                    </span>
                  )}
                </div>
              )}

              {/* Progress Bar */}
              {progress.total_cards && progress.total_cards > 0 && (
                <div className="w-full h-2 bg-muted rounded-full 
                              overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                {isCompleted && (
                  <Badge variant="default" className="bg-green-500">
                    Completed
                  </Badge>
                )}
                {isInProgress && (
                  <Badge variant="secondary">
                    In Progress
                  </Badge>
                )}
                {isNew && (
                  <Badge variant="outline">
                    New
                  </Badge>
                )}
              </div>
            </div>

            {/* Last Studied */}
            {progress.last_studied && (
              <div className="pt-2 border-t text-xs text-muted-foreground">
                Last studied: {formatDate(progress.last_studied)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

