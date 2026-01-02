'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { LibraryDeck } from '@/lib/series/libraryData'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface LibraryListProps {
  decks: LibraryDeck[]
}

/**
 * Displays library decks in a vertical list layout.
 * Input: library deck array
 * Output: List layout component
 */
export function LibraryList({ decks }: LibraryListProps) {
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
    <div className="space-y-4">
      {decks.map((deck, index) => {
        const { chapter, series, progress } = deck
        const isCompleted = progress.completed === true
        const isInProgress = !isCompleted && progress.num_cards_studied > 0
        const isNew = progress.num_cards_studied === 0 || progress.num_cards_studied < 5
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
              <Card className="transition-all hover:shadow-md 
                             hover:bg-muted/50 cursor-pointer group">
                <CardContent className="px-6">
                  <div className="flex flex-col space-y-3">
                    {/* Series Name and Chapter */}
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/browse/${series.slug}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline text-sm font-medium text-foreground 
                                 hover:text-primary hover:underline 
                                 transition-colors"
                      >
                        {series.name}
                      </Link>
                      <span className="text-muted-foreground">•</span>
                      <h3 className="font-semibold text-lg text-muted-foreground">
                        Chapter {chapter.chapter_number}
                      </h3>
                    </div>

                    {/* Progress Info */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between 
                                   text-sm">
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
                        <div className="flex items-center gap-4 text-xs 
                                     text-muted-foreground">
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

                      {/* Status and Last Studied */}
                      <div className="flex items-center gap-2 flex-wrap">
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
                        {progress.last_studied && (
                          <span className="text-xs text-muted-foreground">
                            Last studied: {formatDate(progress.last_studied)}
                          </span>
                        )}
                      </div>
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

