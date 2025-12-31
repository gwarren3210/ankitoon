import Link from 'next/link'
import { Tables } from '@/types/database.types'
import { VocabStats } from '@/types/series.types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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

  const cardsProgress = progress && progress.total_cards
    ? Math.round(((progress.cards_studied ?? 0) / progress.total_cards) * 100)
    : 0

  const hasProgress = progress && (progress.cards_studied ?? 0) > 0

  return (
    <Link href={`/browse/${series.slug}`}>
      <Card className="transition-all hover:shadow-lg hover:-translate-y-1 
                      hover:translate-x-1 cursor-pointer group h-full 
                      overflow-hidden duration-300">
        <CardContent className="p-0">
          <div className="flex gap-0">
            {/* Cover Image - Hidden on mobile */}
            <div className="hidden md:flex pl-4 items-center">
              <div className="relative flex-shrink-0 w-20 h-24 
                            overflow-hidden rounded-lg">
                {series.picture_url ? (
                  <Image
                    src={series.picture_url}
                    alt={series.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted 
                                flex items-center justify-center">
                    <span className="text-muted-foreground text-xs">
                      No cover
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Series Info - Better structured */}
            <div className="flex-1 min-w-0 px-4 md:px-5 space-y-3">
              {/* Title and Stats Row */}
              <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-6">
                {/* Title Section */}
                <div className="flex-shrink-0 flex flex-row md:flex-col items-baseline md:items-start gap-2 md:gap-0 md:space-y-1">
                  <h3 className="font-bold text-xl line-clamp-1 
                               group-hover:text-primary transition-colors">
                    {series.name}
                  </h3>
                  {series.korean_name && (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {series.korean_name}
                    </p>
                  )}
                </div>

                {/* Stats and Tags - Hidden on mobile */}
                <div className="hidden md:flex flex-col gap-2">
                  {/* Stats Row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 
                                text-sm text-muted-foreground">
                    <span className="font-medium">{series.num_chapters} chapters</span>
                    <span className="font-medium">{vocabStats.totalVocabulary} words</span>
                    {vocabStats.uniqueTerms > 0 && (
                      <span>{vocabStats.uniqueTerms} unique</span>
                    )}
                  </div>

                  {/* Genres */}
                  {series.genres && series.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {series.genres.slice(0, 3).map((genre, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="text-xs font-normal"
                        >
                          {genre}
                        </Badge>
                      ))}
                      {series.genres.length > 3 && (
                        <Badge variant="outline" className="text-xs font-normal">
                          +{series.genres.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Section - Visual progress bars */}
              {isAuthenticated && progress && (
                <div className="pt-2 space-y-2 border-t">
                  {(progress.cards_studied ?? 0) > 0 && progress.total_cards && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Cards studied
                        </span>
                        <span className="font-semibold">
                          {progress.cards_studied} / {progress.total_cards}
                        </span>
                      </div>
                      <Progress 
                        value={cardsProgress} 
                        className="h-1.5"
                      />
                    </div>
                  )}
                  {progress.chapters_completed > 0 && progress.total_chapters && (
                    <div className="hidden md:block space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Chapters completed
                        </span>
                        <span className="font-semibold">
                          {progress.chapters_completed} / {progress.total_chapters}
                        </span>
                      </div>
                      <Progress 
                        value={completionPercentage} 
                        className="h-1.5"
                      />
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