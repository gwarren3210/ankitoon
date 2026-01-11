"use client"

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ChapterVocabulary } from '@/types/series.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, getStateBadgeVariant } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VocabularyStats } from '@/components/chapter/vocabularyStats'
import { 
  applyFilters, 
  FilterState, 
  StudyStatusFilter, 
  DueStatusFilter 
} from '@/lib/chapter/vocabularyFilters'
import { 
  sortVocabulary, 
  SortField, 
  SortDirection 
} from '@/lib/chapter/vocabularySorters'
import { 
  formatRelativeTime, 
  formatDueTime, 
  getDueDateColor 
} from '@/lib/chapter/vocabularyUtils'

interface VocabularyListProps {
  vocabulary: ChapterVocabulary[]
}

const DEFAULT_ITEMS_PER_PAGE = 20
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

type ColumnVisibility = {
  reviewCount: boolean
  lastStudied: boolean
  nextDue: boolean
  stability: boolean
  difficulty: boolean
  streakCorrect: boolean
  state: boolean
}

/**
 * Displays enhanced vocabulary list with filtering, sorting, and statistics.
 * Input: vocabulary array
 * Output: Enhanced vocabulary list component
 */
export function VocabularyList({ vocabulary }: VocabularyListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(
    searchParams.get('pageSize') || String(DEFAULT_ITEMS_PER_PAGE),
    10
  )
  const sortBy = (searchParams.get('sortBy') || 
    'importanceScore') as SortField
  const sortDirection = (searchParams.get('sortDirection') || 
    'desc') as SortDirection
  const filterState = (searchParams.get('filterState') || 
    'all') as FilterState
  const filterStudyStatus = (searchParams.get('filterStudyStatus') || 
    'all') as StudyStatusFilter
  const filterDueStatus = (searchParams.get('filterDueStatus') || 
    'all') as DueStatusFilter
  const searchQuery = searchParams.get('search') || ''
  
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    reviewCount: true,
    lastStudied: true,
    nextDue: true,
    stability: false,
    difficulty: false,
    streakCorrect: false,
    state: true
  })
  
  const [showFilters, setShowFilters] = useState(false)
  const [showColumns, setShowColumns] = useState(false)
  
  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams)
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })
    
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const filteredVocabulary = useMemo(() => {
    return applyFilters(vocabulary, {
      state: filterState,
      studyStatus: filterStudyStatus,
      dueStatus: filterDueStatus,
      search: searchQuery
    })
  }, [vocabulary, filterState, filterStudyStatus, filterDueStatus, searchQuery])

  const sortedVocabulary = useMemo(() => {
    return sortVocabulary(filteredVocabulary, sortBy, sortDirection)
  }, [filteredVocabulary, sortBy, sortDirection])

  const totalPages = Math.ceil(sortedVocabulary.length / pageSize)
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedVocabulary = sortedVocabulary.slice(startIndex, endIndex)

  const handlePageChange = (newPage: number) => {
    updateParams({ page: String(newPage) })
  }

  const handleSortChange = (newSort: SortField) => {
    const newDirection = sortBy === newSort && sortDirection === 'desc' 
      ? 'asc' 
      : 'desc'
    updateParams({ sortBy: newSort, sortDirection: newDirection, page: '1' })
  }

  const handleFilterChange = (
    key: string, 
    value: string
  ) => {
    updateParams({ [key]: value, page: '1' })
  }

  const handleSearchChange = (query: string) => {
    updateParams({ search: query || null, page: '1' })
  }

  const handlePageSizeChange = (newSize: number) => {
    updateParams({ pageSize: String(newSize), page: '1' })
  }

  if (vocabulary.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            No vocabulary available for this chapter.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">
          Vocabulary ({vocabulary.length} words)
        </h2>
      </div>

      <VocabularyStats vocabulary={vocabulary} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <CardTitle>Vocabulary List</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? 'Hide' : 'Show'} Filters
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="pageSize" className="text-sm">
                Items per page:
              </Label>
              <select
                id="pageSize"
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {PAGE_SIZE_OPTIONS.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <Badge variant="outline">
                Page {page} of {totalPages}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {showFilters && (
            <div className="mb-6 p-4 border rounded-lg space-y-4">
              <div>
                <Label htmlFor="search" className="mb-2 block">
                  Search
                </Label>
                <Input
                  id="search"
                  placeholder="Search term, definition, or example..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="max-w-md"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="mb-2 block">Card State</Label>
                  <select
                    value={filterState}
                    onChange={(e) => handleFilterChange('filterState', e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  >
                    <option value="all">All</option>
                    <option value="new">New</option>
                    <option value="learning">Learning</option>
                    <option value="review">Review</option>
                    <option value="relearning">Relearning</option>
                  </select>
                </div>
                
                <div>
                  <Label className="mb-2 block">Study Status</Label>
                  <select
                    value={filterStudyStatus}
                    onChange={(e) => handleFilterChange('filterStudyStatus', e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  >
                    <option value="all">All</option>
                    <option value="studied">Studied</option>
                    <option value="not-studied">Not Studied</option>
                  </select>
                </div>
                
                <div>
                  <Label className="mb-2 block">Due Status</Label>
                  <select
                    value={filterDueStatus}
                    onChange={(e) => handleFilterChange('filterDueStatus', e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  >
                    <option value="all">All</option>
                    <option value="due-now">Due Now</option>
                    <option value="due-soon">Due Soon</option>
                    <option value="not-due">Not Due</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={sortBy === 'importanceScore' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSortChange('importanceScore')}
              >
                Sort by Importance
                {sortBy === 'importanceScore' && 
                  (sortDirection === 'asc' ? ' ↑' : ' ↓')}
              </Button>
              <Button
                variant={sortBy === 'wordLength' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSortChange('wordLength')}
              >
                Sort by Length
                {sortBy === 'wordLength' && 
                  (sortDirection === 'asc' ? ' ↑' : ' ↓')}
              </Button>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowColumns(!showColumns)}
            >
              {showColumns ? 'Hide' : 'Show'} Columns
            </Button>
          </div>

          {showColumns && (
            <div className="mb-4 p-3 border rounded-lg">
              <Label className="mb-2 block">Column Visibility</Label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={columnVisibility.reviewCount}
                    onChange={(e) => setColumnVisibility({
                      ...columnVisibility,
                      reviewCount: e.target.checked
                    })}
                  />
                  Review Count
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={columnVisibility.lastStudied}
                    onChange={(e) => setColumnVisibility({
                      ...columnVisibility,
                      lastStudied: e.target.checked
                    })}
                  />
                  Last Studied
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={columnVisibility.nextDue}
                    onChange={(e) => setColumnVisibility({
                      ...columnVisibility,
                      nextDue: e.target.checked
                    })}
                  />
                  Next Due
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={columnVisibility.stability}
                    onChange={(e) => setColumnVisibility({
                      ...columnVisibility,
                      stability: e.target.checked
                    })}
                  />
                  Stability
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={columnVisibility.difficulty}
                    onChange={(e) => setColumnVisibility({
                      ...columnVisibility,
                      difficulty: e.target.checked
                    })}
                  />
                  Difficulty
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={columnVisibility.streakCorrect}
                    onChange={(e) => setColumnVisibility({
                      ...columnVisibility,
                      streakCorrect: e.target.checked
                    })}
                  />
                  Streak
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={columnVisibility.state}
                    onChange={(e) => setColumnVisibility({
                      ...columnVisibility,
                      state: e.target.checked
                    })}
                  />
                  State
                </label>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th 
                    className="text-left p-3 font-medium cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSortChange('term')}
                  >
                    Term
                    {sortBy === 'term' && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                  </th>
                  <th 
                    className="text-left p-3 font-medium cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSortChange('definition')}
                  >
                    Definition
                    {sortBy === 'definition' && 
                      (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                  </th>
                  {columnVisibility.reviewCount && (
                    <th 
                      className="text-left p-3 font-medium cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSortChange('reviewCount')}
                    >
                      Reviews
                      {sortBy === 'reviewCount' && 
                        (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                    </th>
                  )}
                  {columnVisibility.lastStudied && (
                    <th 
                      className="text-left p-3 font-medium cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSortChange('lastStudied')}
                    >
                      Last Studied
                      {sortBy === 'lastStudied' && 
                        (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                    </th>
                  )}
                  {columnVisibility.nextDue && (
                    <th 
                      className="text-left p-3 font-medium cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSortChange('nextDue')}
                    >
                      Next Due
                      {sortBy === 'nextDue' && 
                        (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                    </th>
                  )}
                  {columnVisibility.streakCorrect && (
                    <th 
                      className="text-left p-3 font-medium cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSortChange('streakCorrect')}
                    >
                      Streak
                      {sortBy === 'streakCorrect' && 
                        (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                    </th>
                  )}
                  {columnVisibility.stability && (
                    <th 
                      className="text-left p-3 font-medium cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSortChange('stability')}
                    >
                      Stability
                      {sortBy === 'stability' && 
                        (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                    </th>
                  )}
                  {columnVisibility.difficulty && (
                    <th 
                      className="text-left p-3 font-medium cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSortChange('difficulty')}
                    >
                      Difficulty
                      {sortBy === 'difficulty' && 
                        (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                    </th>
                  )}
                  {columnVisibility.state && (
                    <th className="text-left p-3 font-medium">State</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedVocabulary.length === 0 ? (
                  <tr>
                    <td 
                      colSpan={
                        2 + 
                        (columnVisibility.reviewCount ? 1 : 0) +
                        (columnVisibility.lastStudied ? 1 : 0) +
                        (columnVisibility.nextDue ? 1 : 0) +
                        (columnVisibility.streakCorrect ? 1 : 0) +
                        (columnVisibility.stability ? 1 : 0) +
                        (columnVisibility.difficulty ? 1 : 0) +
                        (columnVisibility.state ? 1 : 0)
                      }
                      className="p-12 text-center text-muted-foreground"
                    >
                      No vocabulary matches the current filters.
                    </td>
                  </tr>
                ) : (
                  paginatedVocabulary.map((vocab, index) => (
                    <VocabularyTableRow
                      key={vocab.vocabularyId}
                      vocab={vocab}
                      columnVisibility={columnVisibility}
                      index={index}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(endIndex, 
                  sortedVocabulary.length)} of {sortedVocabulary.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface VocabularyTableRowProps {
  vocab: ChapterVocabulary
  columnVisibility: ColumnVisibility
  index: number
}

function VocabularyTableRow({ vocab, columnVisibility, index }: VocabularyTableRowProps) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="border-b hover:bg-muted/50"
    >
      <td className="p-3">
        <div className="font-semibold">{vocab.term}</div>
        {(vocab.chapterExample || vocab.example) && (
          <div className="text-sm italic text-muted-foreground mt-1">
            &quot;{vocab.chapterExample || vocab.example}&quot;
          </div>
        )}
      </td>
      <td className="p-3 text-muted-foreground">{vocab.definition}</td>
      {columnVisibility.reviewCount && (
        <td className="p-3 text-muted-foreground">
          {vocab.totalReviews !== undefined ? vocab.totalReviews : '-'}
        </td>
      )}
      {columnVisibility.lastStudied && (
        <td className="p-3 text-muted-foreground">
          {vocab.lastStudied ? formatRelativeTime(vocab.lastStudied) : '-'}
        </td>
      )}
      {columnVisibility.nextDue && (
        <td className={`p-3 ${vocab.nextDue ? getDueDateColor(vocab.nextDue) : 'text-muted-foreground'}`}>
          {vocab.nextDue ? formatDueTime(vocab.nextDue) : '-'}
        </td>
      )}
      {columnVisibility.streakCorrect && (
        <td className="p-3 text-muted-foreground">
          {vocab.streakCorrect !== undefined ? vocab.streakCorrect : '-'}
        </td>
      )}
      {columnVisibility.stability && (
        <td className="p-3 text-muted-foreground">
          {vocab.stability !== undefined ? vocab.stability.toFixed(2) : '-'}
        </td>
      )}
      {columnVisibility.difficulty && (
        <td className="p-3 text-muted-foreground">
          {vocab.difficulty !== undefined ? vocab.difficulty.toFixed(2) : '-'}
        </td>
      )}
      {columnVisibility.state && (
        <td className="p-3">
          {vocab.cardState && (
            <Badge 
              variant={getStateBadgeVariant(vocab.cardState)} 
              className="text-xs"
            >
              {vocab.cardState}
            </Badge>
          )}
        </td>
      )}
    </motion.tr>
  )
}