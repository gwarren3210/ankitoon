'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback, useMemo } from 'react'

/**
 * Filter value for card type selection.
 * 'all' = show both vocabulary and grammar cards
 * 'vocabulary' = show only vocabulary cards
 * 'grammar' = show only grammar cards
 */
export type CardTypeFilterValue = 'all' | 'vocabulary' | 'grammar'

/**
 * Hook for managing card type filter via URL query params.
 * Provides shareable/bookmarkable filter state.
 * Input: none (reads from URL)
 * Output: current filter, setter, and API-ready value
 */
export function useCardTypeFilter() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Read filter from URL, default to 'all'
  const filter = useMemo((): CardTypeFilterValue => {
    const type = searchParams.get('type')
    if (type === 'vocabulary' || type === 'grammar') {
      return type
    }
    return 'all'
  }, [searchParams])

  // Update URL with new filter value
  const setFilter = useCallback(
    (value: CardTypeFilterValue) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === 'all') {
        params.delete('type')
      } else {
        params.set('type', value)
      }
      const queryString = params.toString()
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname
      router.replace(newUrl)
    },
    [searchParams, router, pathname]
  )

  // Convert filter value to API format (undefined for 'all')
  const cardTypeForApi = useMemo(
    (): 'vocabulary' | 'grammar' | undefined => {
      return filter === 'all' ? undefined : filter
    },
    [filter]
  )

  return {
    filter,
    setFilter,
    cardTypeForApi
  }
}
