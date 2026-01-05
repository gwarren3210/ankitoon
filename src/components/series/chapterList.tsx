'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Tables } from '@/types/database.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type Chapter = Tables<'chapters'>
type ChapterProgress = Tables<'user_chapter_progress_summary'>

interface ChapterWithProgress extends Chapter {
  vocabularyCount: number
  progress?: ChapterProgress
}

interface ChapterListProps {
  seriesSlug: string
  chapters: ChapterWithProgress[]
}

/**
 * Displays list of chapters with progress indicators and vocabulary counts.
 * Input: series slug, chapters with progress, auth status
 * Output: Chapter list component
 */
export function ChapterList({ seriesSlug, chapters }: ChapterListProps) {
  if (chapters.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No chapters available yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chapters</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {chapters.map((chapter, index) => (
            <motion.div
              key={chapter.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <ChapterListItem
                chapter={chapter}
                seriesSlug={seriesSlug}
              />
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface ChapterListItemProps {
  chapter: ChapterWithProgress
  seriesSlug: string
}

function ChapterListItem({ chapter, seriesSlug }: ChapterListItemProps) {
  const progress = chapter.progress
  const isCompleted = progress?.completed === true
  const isInProgress = progress && !isCompleted && progress.num_cards_studied > 0

  return (
    <div className="p-3 sm:p-4 rounded-lg border hover:bg-muted/50 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <Link
          href={`/browse/${seriesSlug}/${chapter.chapter_number}`}
          className="flex-1 min-w-0"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span className="font-medium text-sm sm:text-base">
              Chapter {chapter.chapter_number}
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 mt-1 text-xs sm:text-sm text-muted-foreground">
            <span>{chapter.vocabularyCount} words</span>

            {progress && (
                <span>{progress.unique_vocab_seen} seen</span>
            )}
          </div>
        </Link>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Progress Indicator */}
          {progress && (
            <>
              {isCompleted && (
                <Badge variant="default" className="bg-brand-green text-xs">
                  ✓ Completed
                </Badge>
              )}
              {isInProgress && (
                <Badge variant="secondary" className="text-xs">
                  ▶ In Progress
                </Badge>
              )}
              {!progress && (
                <Badge variant="outline" className="text-xs">
                  New
                </Badge>
              )}
            </>
          )}

          {/* Study Button */}
          <Button size="sm" variant="outline" asChild className="text-xs sm:text-sm">
            <Link href={`/study/${seriesSlug}/${chapter.chapter_number}`}>
              Study
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
