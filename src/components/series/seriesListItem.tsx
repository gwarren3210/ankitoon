import Link from 'next/link'
import { Tables } from '@/types/database.types'
import { VocabStats } from '@/types/series.types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'

type Series = Tables<'series'>
type Progress = Tables<'user_series_progress_summary'>

interface SeriesListItemProps {
  series: Series
  vocabStats: VocabStats
  progress?: Progress | null
  isAuthenticated: boolean
}

/**
 * Displays series in horizontal row layout for list view.
 * Input: series data, vocabulary stats, optional progress, auth status
 * Output: Series list item component
 */
export function SeriesListItem({
  series,
  vocabStats,
  progress,
  isAuthenticated
}: SeriesListItemProps) {
  const completionPercentage = progress && progress.total_chapters
    ? Math.round((progress.chapters_completed / progress.total_chapters) * 100)
    : 0

  const hasProgress = progress && (progress.cards_studied || 0) > 0

  return (
    <Link href={`/browse/${series.slug}`}>
      <Card className="transition-all hover:shadow-md cursor-pointer 
                      group h-full">
        <CardContent className="p-0">
          <div className="flex gap-4 p-4">
            {/* Small Cover Image */}
            <div className="relative flex-shrink-0 w-20 h-28 
                          overflow-hidden rounded-lg">
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
                  <span className="text-muted-foreground text-xs">
                    No cover
                  </span>
                </div>
              )}
              {/* Progress Badge Overlay */}
              {isAuthenticated && hasProgress && (
                <div className="absolute top-1 right-1">
                  <Badge 
                    variant={completionPercentage === 100 
                      ? "default" 
                      : "secondary"}
                    className="bg-background/90 backdrop-blur-sm text-xs px-1.5 py-0">
                    {completionPercentage}%
                  </Badge>
                </div>
              )}
            </div>

            {/* Series Info */}
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <h3 className="font-semibold text-lg line-clamp-1">
                  {series.name}
                </h3>
                {series.korean_name && (
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {series.korean_name}
                  </p>
                )}
              </div>

              {/* Stats Row */}
              <div className="flex flex-wrap gap-4 text-sm 
                            text-muted-foreground">
                <span>{series.num_chapters} chapters</span>
                <span>{vocabStats.totalVocabulary} words</span>
                {vocabStats.uniqueTerms > 0 && (
                  <span>{vocabStats.uniqueTerms} unique terms</span>
                )}
              </div>

              {/* Genres */}
              {series.genres && series.genres.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {series.genres.slice(0, 3).map((genre, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="text-xs"
                    >
                      {genre}
                    </Badge>
                  ))}
                  {series.genres.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{series.genres.length - 3}
                    </Badge>
                  )}
                </div>
              )}

              {/* Progress Info */}
              {isAuthenticated && progress && (
                <div className="flex flex-wrap gap-4 text-xs 
                              text-muted-foreground pt-1">
                  {(progress.cards_studied ?? 0) > 0 && (
                    <span>
                      <span className="font-medium">
                        {progress.cards_studied}
                      </span>
                      {progress.total_cards && (
                        <> / {progress.total_cards}</>
                      )}{' '}
                      cards studied
                    </span>
                  )}
                  {progress.chapters_completed > 0 && (
                    <span>
                      <span className="font-medium">
                        {progress.chapters_completed}
                      </span>
                      {progress.total_chapters && (
                        <> / {progress.total_chapters}</>
                      )}{' '}
                      chapters completed
                    </span>
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

