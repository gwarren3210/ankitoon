'use client'

import { useState, useCallback } from 'react'

export type ViewMode = 'grid' | 'list'

/**
 * Hook for managing grid/list view mode toggle state.
 * Input: optional default mode (defaults to 'grid')
 * Output: view mode state with setter and convenience booleans
 */
export function useViewModeToggle(defaultMode: ViewMode = 'grid') {
  const [viewMode, setViewModeState] = useState<ViewMode>(defaultMode)

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode)
  }, [])

  return {
    viewMode,
    setViewMode,
    isGrid: viewMode === 'grid',
    isList: viewMode === 'list'
  }
}
