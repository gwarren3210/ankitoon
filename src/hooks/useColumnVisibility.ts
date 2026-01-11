import { useState, useCallback } from 'react'

/**
 * Column visibility configuration for vocabulary table.
 */
export type ColumnVisibility = {
  reviewCount: boolean
  lastStudied: boolean
  nextDue: boolean
  stability: boolean
  difficulty: boolean
  streakCorrect: boolean
  state: boolean
}

/**
 * Default column visibility settings.
 * Shows common columns by default, hides advanced FSRS metrics.
 */
const DEFAULT_VISIBILITY: ColumnVisibility = {
  reviewCount: true,
  lastStudied: true,
  nextDue: true,
  stability: false,
  difficulty: false,
  streakCorrect: false,
  state: true
}

/**
 * Hook for managing vocabulary table column visibility.
 *
 * Provides:
 * - Current visibility state
 * - Toggle function for individual columns
 * - Toggle function for all columns at once
 * - Ability to count visible columns
 *
 * Input: optional initial visibility state
 * Output: visibility state and control functions
 */
export function useColumnVisibility(
  initialVisibility: ColumnVisibility = DEFAULT_VISIBILITY
) {
  const [visibility, setVisibility] = useState<ColumnVisibility>(
    initialVisibility
  )

  /**
   * Toggle a single column's visibility.
   * Input: column key from ColumnVisibility
   * Output: void (updates state)
   */
  const toggleColumn = useCallback((column: keyof ColumnVisibility) => {
    setVisibility(prev => ({
      ...prev,
      [column]: !prev[column]
    }))
  }, [])

  /**
   * Set visibility for a specific column.
   * Input: column key and boolean value
   * Output: void (updates state)
   */
  const setColumn = useCallback((
    column: keyof ColumnVisibility,
    value: boolean
  ) => {
    setVisibility(prev => ({
      ...prev,
      [column]: value
    }))
  }, [])

  /**
   * Show all columns.
   * Input: none
   * Output: void (updates state)
   */
  const showAll = useCallback(() => {
    setVisibility({
      reviewCount: true,
      lastStudied: true,
      nextDue: true,
      stability: true,
      difficulty: true,
      streakCorrect: true,
      state: true
    })
  }, [])

  /**
   * Hide all columns (except term and definition which are always shown).
   * Input: none
   * Output: void (updates state)
   */
  const hideAll = useCallback(() => {
    setVisibility({
      reviewCount: false,
      lastStudied: false,
      nextDue: false,
      stability: false,
      difficulty: false,
      streakCorrect: false,
      state: false
    })
  }, [])

  /**
   * Reset to default visibility.
   * Input: none
   * Output: void (updates state)
   */
  const resetToDefaults = useCallback(() => {
    setVisibility(DEFAULT_VISIBILITY)
  }, [])

  /**
   * Count how many columns are currently visible.
   * Input: none
   * Output: number of visible columns
   */
  const visibleCount = Object.values(visibility).filter(Boolean).length

  /**
   * Calculate colspan for empty state message.
   * Input: none
   * Output: number (base 2 + visible columns)
   */
  const getColspan = useCallback(() => {
    return 2 + visibleCount // 2 for term and definition
  }, [visibleCount])

  return {
    visibility,
    toggleColumn,
    setColumn,
    showAll,
    hideAll,
    resetToDefaults,
    visibleCount,
    getColspan
  }
}
