import { ChapterVocabulary } from '@/types/series.types'

export type FilterState = 'all' | 'new' | 'learning' | 'review' | 'relearning'
export type StudyStatusFilter = 'all' | 'studied' | 'not-studied'
export type DueStatusFilter = 'all' | 'due-now' | 'due-soon' | 'not-due'

/**
 * Filters vocabulary by card state.
 * Input: vocabulary array, filter state
 * Output: filtered vocabulary array
 */
export function filterByState(
  vocab: ChapterVocabulary[],
  filter: FilterState
): ChapterVocabulary[] {
  if (filter === 'all') return vocab
  return vocab.filter(v => v.cardState === filter.charAt(0).toUpperCase() + filter.slice(1))
}

/**
 * Filters vocabulary by study status.
 * Input: vocabulary array, study status filter
 * Output: filtered vocabulary array
 */
export function filterByStudyStatus(
  vocab: ChapterVocabulary[],
  filter: StudyStatusFilter
): ChapterVocabulary[] {
  if (filter === 'all') return vocab
  if (filter === 'studied') {
    return vocab.filter(v => v.isStudied === true)
  }
  return vocab.filter(v => v.isStudied !== true)
}

/**
 * Filters vocabulary by due status.
 * Input: vocabulary array, due status filter
 * Output: filtered vocabulary array
 */
export function filterByDueStatus(
  vocab: ChapterVocabulary[],
  filter: DueStatusFilter
): ChapterVocabulary[] {
  if (filter === 'all') return vocab
  const now = new Date()
  
  return vocab.filter(v => {
    if (v.cardState === 'New') {
      return filter === 'not-due'
    }
    if (!v.nextDue) {
      return filter === 'not-due'
    }
    const dueDate = new Date(v.nextDue)
    const diffMs = dueDate.getTime() - now.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    
    if (filter === 'due-now') return diffDays < 0
    if (filter === 'due-soon') return diffDays >= 0 && diffDays < 1
    return diffDays >= 1
  })
}

/**
 * Filters vocabulary by text search.
 * Input: vocabulary array, search query
 * Output: filtered vocabulary array
 */
export function filterByText(
  vocab: ChapterVocabulary[],
  query: string
): ChapterVocabulary[] {
  if (!query.trim()) return vocab
  const lowerQuery = query.toLowerCase()
  
  return vocab.filter(v => {
    return (
      v.term.toLowerCase().includes(lowerQuery) ||
      v.definition.toLowerCase().includes(lowerQuery) ||
      (v.example && v.example.toLowerCase().includes(lowerQuery))
    )
  })
}

/**
 * Applies all filters to vocabulary array.
 * Input: vocabulary array, filter options
 * Output: filtered vocabulary array
 */
export function applyFilters(
  vocab: ChapterVocabulary[],
  filters: {
    state?: FilterState
    studyStatus?: StudyStatusFilter
    dueStatus?: DueStatusFilter
    search?: string
  }
): ChapterVocabulary[] {
  let filtered = vocab
  
  if (filters.state) {
    filtered = filterByState(filtered, filters.state)
  }
  
  if (filters.studyStatus) {
    filtered = filterByStudyStatus(filtered, filters.studyStatus)
  }
  
  if (filters.dueStatus) {
    filtered = filterByDueStatus(filtered, filters.dueStatus)
  }
  
  if (filters.search) {
    filtered = filterByText(filtered, filters.search)
  }
  
  return filtered
}

