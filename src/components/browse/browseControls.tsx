'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { LayoutGrid, List } from 'lucide-react'
import { Tables } from '@/types/database.types'
import { sortByOption, numericValue, SortOptionsMap } from '@/lib/sorting/sorters'
import { VocabStats } from '@/types/series.types'
import { useViewModeToggle } from '@/lib/hooks/useViewModeToggle'
import { useControlsFilter } from '@/lib/hooks/useControlsFilter'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SeriesGrid } from '@/components/browse/seriesGrid'
import { SeriesList } from '@/components/browse/seriesList'

type Series = Tables<'series'>
type Progress = Tables<'user_series_progress_summary'>

type SortOption =
  | 'name-asc'
  | 'name-desc'
  | 'popularity-asc'
  | 'popularity-desc'
  | 'chapters-asc'
  | 'chapters-desc'
  | 'progress-asc'
  | 'progress-desc'

interface SeriesWithData {
  series: Series
  vocabStats: VocabStats
  progress?: Progress | null
}

const browseSortOptions: SortOptionsMap<SeriesWithData, SortOption> = {
  'name-asc': {
    getValue: s => s.series.name,
    direction: 'asc'
  },
  'name-desc': {
    getValue: s => s.series.name,
    direction: 'desc'
  },
  'popularity-asc': {
    getValue: numericValue(s => s.series.popularity),
    direction: 'asc'
  },
  'popularity-desc': {
    getValue: numericValue(s => s.series.popularity),
    direction: 'desc'
  },
  'chapters-asc': {
    getValue: s => s.series.num_chapters,
    direction: 'asc'
  },
  'chapters-desc': {
    getValue: s => s.series.num_chapters,
    direction: 'desc'
  },
  'progress-asc': {
    getValue: numericValue(s => s.progress?.chapters_completed),
    direction: 'asc'
  },
  'progress-desc': {
    getValue: numericValue(s => s.progress?.chapters_completed),
    direction: 'desc'
  }
}

interface BrowseControlsProps {
  seriesData: SeriesWithData[]
  isAuthenticated: boolean
}

/**
 * Client component for browse page controls and filtering.
 * Input: series data array, authentication status
 * Output: Browse controls with search, sort, and view toggle
 */
export function BrowseControls({
  seriesData,
  isAuthenticated
}: BrowseControlsProps) {
  const [sortOption, setSortOption] = useState<SortOption>('name-asc')
  const { setViewMode, isGrid } = useViewModeToggle('grid')

  // Use filter hook (search only, no custom filters)
  const {
    searchQuery,
    setSearchQuery,
    filteredItems,
    hasActiveFilters
  } = useControlsFilter({
    items: seriesData,
    searchFields: [
      ({ series }) => series.name,
      ({ series }) => series.korean_name,
      ({ series }) => series.alt_names?.join(' ')
    ]
  })

  // Sort filtered series
  const sortedSeries = useMemo(
    () => sortByOption(filteredItems, browseSortOptions, sortOption),
    [filteredItems, sortOption]
  )

  return (
    <div className="space-y-6">
      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row gap-4 items-start sm:items-center"
      >
        {/* Search */}
        <div className="flex-1 w-full sm:w-auto">
          <Input
            type="text"
            placeholder="Search series..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Sort */}
        <select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value as SortOption)}
          className="h-9 rounded-md border border-input bg-background
                   px-3 py-1 text-sm shadow-xs focus-visible:outline-none
                   focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="name-asc">Name (A-Z)</option>
          <option value="name-desc">Name (Z-A)</option>
          <option value="popularity-desc">Popularity (High)</option>
          <option value="popularity-asc">Popularity (Low)</option>
          <option value="chapters-desc">Chapters (Most)</option>
          <option value="chapters-asc">Chapters (Fewest)</option>
          {isAuthenticated && (
            <>
              <option value="progress-desc">Progress (Most)</option>
              <option value="progress-asc">Progress (Least)</option>
            </>
          )}
        </select>

        {/* View Toggle */}
        <div className="flex gap-2">
          <Button
            variant={isGrid ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={!isGrid ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('list')}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* Results Count */}
      {hasActiveFilters && (
        <div className="text-sm text-muted-foreground">
          Found {sortedSeries.length} series
          {sortedSeries.length !== seriesData.length && (
            <> out of {seriesData.length}</>
          )}
        </div>
      )}

      {/* Series Display */}
      {sortedSeries.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            {hasActiveFilters
              ? 'No series found matching your search.'
              : 'No series available.'}
          </p>
        </div>
      ) : isGrid ? (
        <SeriesGrid
          seriesData={sortedSeries}
          isAuthenticated={isAuthenticated}
        />
      ) : (
        <SeriesList
          seriesData={sortedSeries}
          isAuthenticated={isAuthenticated}
        />
      )}
    </div>
  )
}
