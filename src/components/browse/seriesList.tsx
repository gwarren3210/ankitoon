import { Tables } from '@/types/database.types'
import { VocabStats } from '@/types/series.types'
import { SeriesListItem } from '@/components/series/seriesListItem'

type Series = Tables<'series'>
type Progress = Tables<'user_series_progress_summary'>

interface SeriesWithData {
  series: Series
  vocabStats: VocabStats
  progress?: Progress | null
}

interface SeriesListProps {
  seriesData: SeriesWithData[]
  isAuthenticated: boolean
}

/**
 * Displays series in a vertical list layout with horizontal rows.
 * Input: series data array, authentication status
 * Output: List layout component
 */
export function SeriesList({
  seriesData,
  isAuthenticated
}: SeriesListProps) {
  return (
    <div className="space-y-4">
      {seriesData.map(({ series, vocabStats, progress }) => (
        <SeriesListItem
          key={series.id}
          series={series}
          vocabStats={vocabStats}
          progress={progress}
          isAuthenticated={isAuthenticated}
        />
      ))}
    </div>
  )
}

