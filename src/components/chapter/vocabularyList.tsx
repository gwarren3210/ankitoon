"use client"

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useMemo } from 'react'
import { ChapterVocabulary } from '@/types/series.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface VocabularyListProps {
  vocabulary: ChapterVocabulary[]
  isAuthenticated: boolean
}

const ITEMS_PER_PAGE = 20

type SortField = 'importanceScore' | 'term'

/**
 * Sorts vocabulary array by specified field.
 * Input: vocabulary array, sort field
 * Output: sorted vocabulary array
 */
function sortVocabulary(
  vocab: ChapterVocabulary[],
  sortBy: SortField
): ChapterVocabulary[] {
  const sorted = [...vocab]
  
  if (sortBy === 'importanceScore') {
    sorted.sort((a, b) => b.importanceScore - a.importanceScore)
  } else if (sortBy === 'term') {
    sorted.sort((a, b) => a.term.localeCompare(b.term))
  }
  
  return sorted
}


/**
 * Displays paginated vocabulary list sorted by importance.
 * Input: vocabulary array, auth status
 * Output: Vocabulary list component with pagination
 */
export function VocabularyList({ 
  vocabulary, 
  isAuthenticated 
}: VocabularyListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(
    searchParams.get('pageSize') || String(ITEMS_PER_PAGE),
    10
  )
  const sortBy = (searchParams.get('sortBy') || 
    'importanceScore') as SortField

  const sortedVocabulary = useMemo(
    () => sortVocabulary(vocabulary, sortBy),
    [vocabulary, sortBy]
  )

  const totalPages = Math.ceil(sortedVocabulary.length / pageSize)
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedVocabulary = sortedVocabulary.slice(
    startIndex,
    endIndex
  )

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

  const handlePageChange = (newPage: number) => {
    updateParams({ page: String(newPage) })
  }

  const handleSortChange = (newSort: SortField) => {
    updateParams({ sortBy: newSort, page: '1' })
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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          Vocabulary ({vocabulary.length} words)
        </h2>
        <div className="flex gap-2">
          <Button
            variant={sortBy === 'importanceScore' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleSortChange('importanceScore')}
          >
            Sort by Importance
          </Button>
          <Button
            variant={sortBy === 'term' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleSortChange('term')}
          >
            Sort by Term
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Vocabulary List</CardTitle>
            <Badge variant="outline">
              Page {page} of {totalPages}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {paginatedVocabulary.map((vocab) => (
              <VocabularyItem
                key={vocab.vocabularyId}
                vocab={vocab}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 
                          border-t">
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

interface VocabularyItemProps {
  vocab: ChapterVocabulary
}

function VocabularyItem({ vocab }: VocabularyItemProps) {
  return (
    <div className="flex items-start justify-between p-3 rounded-lg border">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-lg">{vocab.term}</span>
          {vocab.isStudied && (
            <Badge variant="default" className="text-xs bg-green-500">
              Studied
            </Badge>
          )}
        </div>

        <p className="text-muted-foreground mb-2">{vocab.definition}</p>

        {vocab.example && (
          <p className="text-sm italic text-muted-foreground">
            "{vocab.example}"
          </p>
        )}
      </div>
    </div>
  )
}
