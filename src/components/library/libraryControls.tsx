'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { LibraryDeck } from '@/lib/series/libraryData'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { LibraryGrid } from '@/components/library/libraryGrid'
import { LibraryList } from '@/components/library/libraryList'

type ViewMode = 'grid' | 'list'

type SortOption =
  | 'last-studied-desc'
  | 'last-studied-asc'
  | 'series-name-asc'
  | 'series-name-desc'
  | 'chapter-number-asc'
  | 'chapter-number-desc'
  | 'progress-desc'
  | 'progress-asc'

type CompletenessFilter = 'all' | 'in-progress' | 'completed' | 'new'

interface LibraryControlsProps {
  decks: LibraryDeck[]
}

/**
 * Client component for library page controls and filtering.
 * Input: library deck array
 * Output: Library controls with search, completeness filter, sort, and view toggle
 */
export function LibraryControls({ decks }: LibraryControlsProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('last-studied-desc')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [completenessFilter, setCompletenessFilter] =
    useState<CompletenessFilter>('all')
  const [seriesFilter, setSeriesFilter] = useState<string>('all')

  // Get unique series for filter dropdown
  const uniqueSeries = useMemo(() => {
    const seriesMap = new Map<string, string>()
    decks.forEach(deck => {
      if (!seriesMap.has(deck.series.id)) {
        seriesMap.set(deck.series.id, deck.series.name)
      }
    })
    return Array.from(seriesMap.entries()).sort((a, b) =>
      a[1].localeCompare(b[1])
    )
  }, [decks])

  // Filter by completeness status
  const filteredByCompleteness = useMemo(() => {
    if (completenessFilter === 'all') {
      return decks
    }

    return decks.filter(deck => {
      const { progress } = deck
      const isCompleted = progress.completed === true
      const isInProgress = !isCompleted && progress.num_cards_studied > 0
      const isNew = progress.num_cards_studied === 0 || progress.num_cards_studied < 5

      switch (completenessFilter) {
        case 'in-progress':
          return isInProgress
        case 'completed':
          return isCompleted
        case 'new':
          return isNew
        default:
          return true
      }
    })
  }, [decks, completenessFilter])

  // Filter by series
  const filteredBySeries = useMemo(() => {
    if (seriesFilter === 'all') {
      return filteredByCompleteness
    }

    return filteredByCompleteness.filter(
      deck => deck.series.id === seriesFilter
    )
  }, [filteredByCompleteness, seriesFilter])

  // Filter by search query
  const filteredDecks = useMemo(() => {
    if (!searchQuery.trim()) {
      return filteredBySeries
    }

    const query = searchQuery.toLowerCase()
    return filteredBySeries.filter(deck => {
      const seriesMatch = deck.series.name.toLowerCase().includes(query)
      const chapterTitleMatch = deck.chapter.title?.toLowerCase().includes(query)
      const chapterNumberMatch = deck.chapter.chapter_number.toString().includes(query)
      return seriesMatch || chapterTitleMatch || chapterNumberMatch
    })
  }, [filteredBySeries, searchQuery])

  // Sort filtered decks
  const sortedDecks = useMemo(() => {
    const sorted = [...filteredDecks]

    switch (sortOption) {
      case 'last-studied-desc':
        return sorted.sort((a, b) => {
          const aDate = a.progress.last_studied
            ? new Date(a.progress.last_studied).getTime()
            : 0
          const bDate = b.progress.last_studied
            ? new Date(b.progress.last_studied).getTime()
            : 0
          return bDate - aDate
        })
      case 'last-studied-asc':
        return sorted.sort((a, b) => {
          const aDate = a.progress.last_studied
            ? new Date(a.progress.last_studied).getTime()
            : 0
          const bDate = b.progress.last_studied
            ? new Date(b.progress.last_studied).getTime()
            : 0
          return aDate - bDate
        })
      case 'series-name-asc':
        return sorted.sort((a, b) =>
          a.series.name.localeCompare(b.series.name)
        )
      case 'series-name-desc':
        return sorted.sort((a, b) =>
          b.series.name.localeCompare(a.series.name)
        )
      case 'chapter-number-asc':
        return sorted.sort((a, b) =>
          a.chapter.chapter_number - b.chapter.chapter_number
        )
      case 'chapter-number-desc':
        return sorted.sort((a, b) =>
          b.chapter.chapter_number - a.chapter.chapter_number
        )
      case 'progress-desc':
        return sorted.sort((a, b) => {
          const aPercent = a.progress.total_cards
            ? a.progress.num_cards_studied / a.progress.total_cards
            : 0
          const bPercent = b.progress.total_cards
            ? b.progress.num_cards_studied / b.progress.total_cards
            : 0
          return bPercent - aPercent
        })
      case 'progress-asc':
        return sorted.sort((a, b) => {
          const aPercent = a.progress.total_cards
            ? a.progress.num_cards_studied / a.progress.total_cards
            : 0
          const bPercent = b.progress.total_cards
            ? b.progress.num_cards_studied / b.progress.total_cards
            : 0
          return aPercent - bPercent
        })
      default:
        return sorted
    }
  }, [filteredDecks, sortOption])

  return (
    <div className="space-y-6">
      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4"
      >
        {/* Top Row: Search and View Toggle */}
        <div className="flex flex-col sm:flex-row gap-4 items-start 
                      sm:items-center">
          <div className="flex-1 w-full sm:w-auto">
            <Input
              type="text"
              placeholder="Search by series or chapter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>

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
        </div>

        {/* Bottom Row: Filters and Sort */}
        <div className="flex flex-col sm:flex-row gap-4 items-start 
                      sm:items-center">
          {/* Completeness Filter */}
          <select
            value={completenessFilter}
            onChange={(e) =>
              setCompletenessFilter(e.target.value as CompletenessFilter)
            }
            className="h-9 rounded-md border border-input bg-background 
                     px-3 py-1 text-sm shadow-xs focus-visible:outline-none 
                     focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="new">New</option>
          </select>

          {/* Series Filter */}
          {uniqueSeries.length > 1 && (
            <select
              value={seriesFilter}
              onChange={(e) => setSeriesFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background 
                       px-3 py-1 text-sm shadow-xs focus-visible:outline-none 
                       focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">All Series</option>
              {uniqueSeries.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          )}

          {/* Sort */}
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="h-9 rounded-md border border-input bg-background 
                     px-3 py-1 text-sm shadow-xs focus-visible:outline-none 
                     focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="last-studied-desc">Last Studied (Recent)</option>
            <option value="last-studied-asc">Last Studied (Oldest)</option>
            <option value="series-name-asc">Series Name (A-Z)</option>
            <option value="series-name-desc">Series Name (Z-A)</option>
            <option value="chapter-number-asc">Chapter Number (Low)</option>
            <option value="chapter-number-desc">Chapter Number (High)</option>
            <option value="progress-desc">Progress (Most)</option>
            <option value="progress-asc">Progress (Least)</option>
          </select>
        </div>
      </motion.div>

      {/* Results Count */}
      {(searchQuery || completenessFilter !== 'all' || seriesFilter !== 'all') && (
        <div className="text-sm text-muted-foreground">
          Found {sortedDecks.length} deck{sortedDecks.length !== 1 ? 's' : ''}
          {sortedDecks.length !== decks.length && (
            <> out of {decks.length}</>
          )}
        </div>
      )}

      {/* Decks Display */}
      {sortedDecks.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            {searchQuery || completenessFilter !== 'all' || seriesFilter !== 'all'
              ? 'No decks found matching your filters.'
              : 'No decks available.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <LibraryGrid decks={sortedDecks} />
      ) : (
        <LibraryList decks={sortedDecks} />
      )}
    </div>
  )
}

