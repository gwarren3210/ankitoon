import Link from 'next/link'
import { Tables } from '@/types/database.types'
import { VocabStats } from '@/types/series.types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'

type Series = Tables<'series'>
type Progress = Tables<'user_series_progress_summary'>

interface SeriesCardProps {
  series: Series
  vocabStats: VocabStats
  progress?: Progress | null
  isAuthenticated: boolean
}

/**
 * Displays series card with cover, name, stats, and progress.
 * Input: series data, vocabulary stats, optional progress, auth status
 * Output: Series card component
 */
export function SeriesCard({
  series,
  vocabStats,
  progress,
  isAuthenticated
}: SeriesCardProps) {
  const completionPercentage = progress && progress.total_chapters
    ? Math.round((progress.chapters_completed / progress.total_chapters) * 100)
    : 0

  const hasProgress = progress && (progress.cards_studied || 0) > 0

  return (
    <Link href={`/browse/${series.slug}`}>
      <Card className="h-full transition-all hover:shadow-md 
                      cursor-pointer group">
        <CardContent className="p-0">
          <div className="flex flex-col">
            {/* Cover Image */}
            <div className="relative w-full aspect-[3/4] 
                          overflow-hidden rounded-t-xl">
              {series.picture_url ? (
                <Image
                  src={series.picture_url}
                  alt={series.name}
                  className="w-full h-full object-cover 
                           group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-full h-full bg-muted 
                              flex items-center justify-center">
                  <span className="text-muted-foreground text-sm">
                    No cover
                  </span>
                </div>
              )}
              {/* Progress Badge Overlay */}
              {isAuthenticated && hasProgress && (
                <div className="absolute top-2 right-2">
                  <Badge 
                    variant={completionPercentage === 100 
                      ? "default" 
                      : "secondary"}
                    className="bg-background/90 backdrop-blur-sm">
                    {completionPercentage}%
                  </Badge>
                </div>
              )}
            </div>

            {/* Series Info */}
            <div className="p-4 space-y-2">
              <div>
                <h3 className="font-semibold text-lg line-clamp-2">
                  {series.name}
                </h3>
                {series.korean_name && (
                  <p className="text-sm text-muted-foreground">
                    {series.korean_name}
                  </p>
                )}
              </div>

              {/* Stats */}
              <div className="flex flex-wrap gap-3 text-sm 
                            text-muted-foreground">
                <span>{series.num_chapters} chapters</span>
                <span>{vocabStats.totalVocabulary} words</span>
              </div>

              {/* Progress Info */}
              {isAuthenticated && progress && (
                <div className="pt-2 border-t space-y-1">
                  {(progress.cards_studied ?? 0) > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">
                        {progress.cards_studied}
                      </span>
                      {progress.total_cards && (
                        <> / {progress.total_cards}</>
                      )}{' '}
                      cards studied
                    </div>
                  )}
                  {(progress.chapters_completed ?? 0) > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">
                        {progress.chapters_completed}
                      </span>
                      {progress.total_chapters && (
                        <> / {progress.total_chapters}</>
                      )}{' '}
                      chapters completed
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

