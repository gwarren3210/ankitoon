'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Tables } from '@/types/database.types'
import { VocabStats } from '@/types/series.types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SeriesGrid } from '@/components/browse/seriesGrid'
import { SeriesList } from '@/components/browse/seriesList'

type Series = Tables<'series'>
type Progress = Tables<'user_series_progress_summary'>

type ViewMode = 'grid' | 'list'

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
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('name-asc')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  // Filter series by search query
  const filteredSeries = useMemo(() => {
    if (!searchQuery.trim()) {
      return seriesData
    }

    const query = searchQuery.toLowerCase()
    return seriesData.filter(({ series }) => {
      const nameMatch = series.name.toLowerCase().includes(query)
      const koreanMatch = series.korean_name?.toLowerCase().includes(query)
      const altNamesMatch = series.alt_names?.some(name =>
        name.toLowerCase().includes(query)
      )
      return nameMatch || koreanMatch || altNamesMatch
    })
  }, [seriesData, searchQuery])

  // Sort filtered series
  const sortedSeries = useMemo(() => {
    const sorted = [...filteredSeries]

    switch (sortOption) {
      case 'name-asc':
        return sorted.sort((a, b) =>
          a.series.name.localeCompare(b.series.name)
        )
      case 'name-desc':
        return sorted.sort((a, b) =>
          b.series.name.localeCompare(a.series.name)
        )
      case 'popularity-asc':
        return sorted.sort((a, b) =>
          (a.series.popularity || 0) - (b.series.popularity || 0)
        )
      case 'popularity-desc':
        return sorted.sort((a, b) =>
          (b.series.popularity || 0) - (a.series.popularity || 0)
        )
      case 'chapters-asc':
        return sorted.sort((a, b) =>
          a.series.num_chapters - b.series.num_chapters
        )
      case 'chapters-desc':
        return sorted.sort((a, b) =>
          b.series.num_chapters - a.series.num_chapters
        )
      case 'progress-asc':
        return sorted.sort((a, b) => {
          const aProgress = a.progress?.chapters_completed || 0
          const bProgress = b.progress?.chapters_completed || 0
          return aProgress - bProgress
        })
      case 'progress-desc':
        return sorted.sort((a, b) => {
          const aProgress = a.progress?.chapters_completed || 0
          const bProgress = b.progress?.chapters_completed || 0
          return bProgress - aProgress
        })
      default:
        return sorted
    }
  }, [filteredSeries, sortOption])

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
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('list')}
            aria-label="List view"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </Button>
        </div>
      </motion.div>

      {/* Results Count */}
      {searchQuery && (
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
            {searchQuery
              ? 'No series found matching your search.'
              : 'No series available.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
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

