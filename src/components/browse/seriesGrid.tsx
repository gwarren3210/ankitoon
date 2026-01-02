'use client'

import { motion } from 'framer-motion'
import { Tables } from '@/types/database.types'
import { VocabStats } from '@/types/series.types'
import { SeriesCard } from '@/components/series/seriesCard'

type Series = Tables<'series'>
type Progress = Tables<'user_series_progress_summary'>

interface SeriesWithData {
  series: Series
  vocabStats: VocabStats
  progress?: Progress | null
}

interface SeriesGridProps {
  seriesData: SeriesWithData[]
  isAuthenticated: boolean
}

/**
 * Displays series in a responsive grid layout.
 * Input: series data array, authentication status
 * Output: Grid layout component
 */
export function SeriesGrid({
  seriesData,
  isAuthenticated
}: SeriesGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 
                  xl:grid-cols-4 gap-6">
      {seriesData.map(({ series, vocabStats, progress }, index) => (
        <motion.div
          key={series.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <SeriesCard
            series={series}
            vocabStats={vocabStats}
            progress={progress}
            isAuthenticated={isAuthenticated}
          />
        </motion.div>
      ))}
    </div>
  )
}

