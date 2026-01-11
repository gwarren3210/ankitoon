'use client'

import { useState, useMemo, useCallback } from 'react'

/**
 * Configuration for a custom filter.
 * Input: filter key, default value, and predicate function
 */
export interface FilterConfig<T, K extends string> {
  key: K
  defaultValue: string
  predicate: (item: T, value: string) => boolean
}

/**
 * Options for the useControlsFilter hook.
 * Input: items array, search field extractors, optional custom filters
 */
export interface UseControlsFilterOptions<T, K extends string> {
  items: T[]
  searchFields: Array<(item: T) => string | null | undefined>
  filters?: FilterConfig<T, K>[]
}

/**
 * Generic hook for filtering items with search and custom filters.
 * Input: items, search field extractors, optional filter configs
 * Output: search/filter state, setters, filtered items, active filter indicator
 */
export function useControlsFilter<T, K extends string = string>(
  options: UseControlsFilterOptions<T, K>
) {
  const { items, searchFields, filters = [] } = options

  // Search state
  const [searchQuery, setSearchQueryState] = useState('')

  // Build initial filter values from configs
  const initialFilterValues = useMemo(() => {
    const values: Record<string, string> = {}
    filters.forEach(f => {
      values[f.key] = f.defaultValue
    })
    return values as Record<K, string>
  }, [filters])

  const [filterValues, setFilterValues] = useState<Record<K, string>>(
    initialFilterValues
  )

  // Memoized setters
  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query)
  }, [])

  const setFilterValue = useCallback(<FK extends K>(key: FK, value: string) => {
    setFilterValues(prev => ({ ...prev, [key]: value }))
  }, [])

  // Apply custom filters
  const filteredByCustomFilters = useMemo(() => {
    if (filters.length === 0) return items

    return items.filter(item => {
      return filters.every(filter => {
        const value = filterValues[filter.key]
        // Skip filter if using default "all" value
        if (value === filter.defaultValue) return true
        return filter.predicate(item, value)
      })
    })
  }, [items, filters, filterValues])

  // Apply search filter
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return filteredByCustomFilters

    return filteredByCustomFilters.filter(item => {
      return searchFields.some(getField => {
        const fieldValue = getField(item)
        return fieldValue?.toLowerCase().includes(query)
      })
    })
  }, [filteredByCustomFilters, searchQuery, searchFields])

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    if (searchQuery.trim()) return true
    return filters.some(filter => filterValues[filter.key] !== filter.defaultValue)
  }, [searchQuery, filters, filterValues])

  return {
    searchQuery,
    setSearchQuery,
    filterValues,
    setFilterValue,
    filteredItems,
    hasActiveFilters
  }
}
