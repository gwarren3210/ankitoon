import { ChapterVocabulary } from '@/types/series.types'

export type SortField = 
  | 'importanceScore'
  | 'term'
  | 'definition'
  | 'lastStudied'
  | 'nextDue'
  | 'reviewCount'
  | 'streakCorrect'
  | 'wordLength'
  | 'stability'
  | 'difficulty'
  | 'firstSeen'

export type SortDirection = 'asc' | 'desc'

const SRS_FIELDS: SortField[] = [
  'lastStudied',
  'nextDue',
  'reviewCount',
  'streakCorrect',
  'stability',
  'difficulty',
  'firstSeen'
]

/**
 * Sorts vocabulary array by specified field and direction.
 * New cards are placed at the end for SRS fields.
 * Input: vocabulary array, sort field, sort direction
 * Output: sorted vocabulary array
 */
export function sortVocabulary(
  vocab: ChapterVocabulary[],
  field: SortField,
  direction: SortDirection = 'desc'
): ChapterVocabulary[] {
  const sorted = [...vocab]
  const isSRSField = SRS_FIELDS.includes(field)
  
  sorted.sort((a, b) => {
    const aIsNew = a.cardState === 'New'
    const bIsNew = b.cardState === 'New'
    
    if (isSRSField) {
      if (aIsNew && !bIsNew) return 1
      if (!aIsNew && bIsNew) return -1
    }
    
    let aVal: number | string | null | undefined
    let bVal: number | string | null | undefined
    
    switch (field) {
      case 'importanceScore':
        aVal = a.importanceScore
        bVal = b.importanceScore
        break
      case 'term':
        aVal = a.term
        bVal = b.term
        break
      case 'definition':
        aVal = a.definition
        bVal = b.definition
        break
      case 'lastStudied':
        aVal = a.lastStudied ? new Date(a.lastStudied).getTime() : 0
        bVal = b.lastStudied ? new Date(b.lastStudied).getTime() : 0
        break
      case 'nextDue':
        aVal = a.nextDue ? new Date(a.nextDue).getTime() : Infinity
        bVal = b.nextDue ? new Date(b.nextDue).getTime() : Infinity
        break
      case 'reviewCount':
        aVal = a.totalReviews || 0
        bVal = b.totalReviews || 0
        break
      case 'streakCorrect':
        aVal = a.streakCorrect || 0
        bVal = b.streakCorrect || 0
        break
      case 'wordLength':
        aVal = a.term.length
        bVal = b.term.length
        break
      case 'stability':
        aVal = a.stability ?? 0
        bVal = b.stability ?? 0
        break
      case 'difficulty':
        aVal = a.difficulty ?? 0
        bVal = b.difficulty ?? 0
        break
      case 'firstSeen':
        aVal = a.firstSeenDate ? new Date(a.firstSeenDate).getTime() : 0
        bVal = b.firstSeenDate ? new Date(b.firstSeenDate).getTime() : 0
        break
      default:
        return 0
    }
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      const comparison = aVal.localeCompare(bVal)
      return direction === 'asc' ? comparison : -comparison
    }
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return direction === 'asc' ? aVal - bVal : bVal - aVal
    }
    
    return 0
  })
  
  return sorted
}

