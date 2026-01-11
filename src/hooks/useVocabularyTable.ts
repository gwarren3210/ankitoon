import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useMemo, useCallback } from 'react'
import { ChapterVocabulary } from '@/types/series.types'
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

const DEFAULT_ITEMS_PER_PAGE = 20

/**
 * Hook for managing vocabulary table state: filtering, sorting, pagination.
 *
 * Manages URL search params for:
 * - Pagination (page, pageSize)
 * - Sorting (sortBy, sortDirection)
 * - Filtering (filterState, filterStudyStatus, filterDueStatus, search)
 *
 * Provides memoized filtered and sorted vocabulary with pagination support.
 *
 * Input: vocabulary array
 * Output: table state and control functions
 */
export function useVocabularyTable(vocabulary: ChapterVocabulary[]) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Parse URL params
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

  /**
   * Update URL search params.
   * Input: object of param updates (null to delete)
   * Output: void (triggers navigation)
   */
  const updateParams = useCallback((
    updates: Record<string, string | null>
  ) => {
    const params = new URLSearchParams(searchParams)

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })

    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }, [searchParams, router, pathname])

  /**
   * Apply filters to vocabulary.
   * Input: vocabulary array
   * Output: filtered vocabulary array
   */
  const filteredVocabulary = useMemo(() => {
    return applyFilters(vocabulary, {
      state: filterState,
      studyStatus: filterStudyStatus,
      dueStatus: filterDueStatus,
      search: searchQuery
    })
  }, [vocabulary, filterState, filterStudyStatus, filterDueStatus,
      searchQuery])

  /**
   * Apply sorting to filtered vocabulary.
   * Input: filtered vocabulary array
   * Output: sorted vocabulary array
   */
  const sortedVocabulary = useMemo(() => {
    return sortVocabulary(filteredVocabulary, sortBy, sortDirection)
  }, [filteredVocabulary, sortBy, sortDirection])

  /**
   * Apply pagination to sorted vocabulary.
   * Input: sorted vocabulary array
   * Output: current page items
   */
  const paginatedVocabulary = useMemo(() => {
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    return sortedVocabulary.slice(startIndex, endIndex)
  }, [sortedVocabulary, page, pageSize])

  /**
   * Calculate pagination metadata.
   * Input: none
   * Output: pagination info object
   */
  const pagination = useMemo(() => {
    const totalPages = Math.ceil(sortedVocabulary.length / pageSize)
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize

    return {
      totalPages,
      currentPage: page,
      pageSize,
      startIndex,
      endIndex,
      totalItems: sortedVocabulary.length,
      isFirstPage: page === 1,
      isLastPage: page >= totalPages
    }
  }, [sortedVocabulary.length, page, pageSize])

  /**
   * Change current page.
   * Input: new page number
   * Output: void (updates URL)
   */
  const handlePageChange = useCallback((newPage: number) => {
    updateParams({ page: String(newPage) })
  }, [updateParams])

  /**
   * Change sort field (toggles direction if same field).
   * Input: new sort field
   * Output: void (updates URL)
   */
  const handleSortChange = useCallback((newSort: SortField) => {
    const newDirection = sortBy === newSort && sortDirection === 'desc'
      ? 'asc'
      : 'desc'
    updateParams({
      sortBy: newSort,
      sortDirection: newDirection,
      page: '1'
    })
  }, [sortBy, sortDirection, updateParams])

  /**
   * Change a filter value.
   * Input: filter key and new value
   * Output: void (updates URL, resets to page 1)
   */
  const handleFilterChange = useCallback((
    key: string,
    value: string
  ) => {
    updateParams({ [key]: value, page: '1' })
  }, [updateParams])

  /**
   * Change search query.
   * Input: new search string
   * Output: void (updates URL, resets to page 1)
   */
  const handleSearchChange = useCallback((query: string) => {
    updateParams({ search: query || null, page: '1' })
  }, [updateParams])

  /**
   * Change page size.
   * Input: new page size
   * Output: void (updates URL, resets to page 1)
   */
  const handlePageSizeChange = useCallback((newSize: number) => {
    updateParams({ pageSize: String(newSize), page: '1' })
  }, [updateParams])

  return {
    // Current state
    page,
    pageSize,
    sortBy,
    sortDirection,
    filterState,
    filterStudyStatus,
    filterDueStatus,
    searchQuery,

    // Processed data
    filteredVocabulary,
    sortedVocabulary,
    paginatedVocabulary,

    // Pagination metadata
    pagination,

    // Control functions
    handlePageChange,
    handleSortChange,
    handleFilterChange,
    handleSearchChange,
    handlePageSizeChange
  }
}
