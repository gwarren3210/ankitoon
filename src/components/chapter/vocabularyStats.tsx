"use client"

import { ChapterVocabulary } from '@/types/series.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface VocabularyStatsProps {
  vocabulary: ChapterVocabulary[]
}

/**
 * Calculates statistics from vocabulary array.
 * Input: vocabulary array
 * Output: statistics object
 */
function calculateStats(vocabulary: ChapterVocabulary[]) {
  const total = vocabulary.length
  const byState = {
    new: 0,
    learning: 0,
    review: 0,
    relearning: 0
  }
  
  let studiedCount = 0
  let totalReviews = 0
  let totalAccuracy = 0
  let accuracyCount = 0
  let dueNow = 0
  let dueSoon = 0
  
  for (const vocab of vocabulary) {
    if (vocab.cardState) {
      const state = vocab.cardState.toLowerCase()
      if (state in byState) {
        byState[state as keyof typeof byState]++
      }
    }
    
    if (vocab.isStudied) {
      studiedCount++
    }
    
    if (vocab.totalReviews) {
      totalReviews += vocab.totalReviews
    }
    
    if (vocab.accuracy !== null && vocab.accuracy !== undefined) {
      totalAccuracy += vocab.accuracy
      accuracyCount++
    }
    
    if (vocab.nextDue) {
      const now = new Date()
      const dueDate = new Date(vocab.nextDue)
      const diffMs = dueDate.getTime() - now.getTime()
      const diffDays = diffMs / (1000 * 60 * 60 * 24)
      
      if (diffDays < 0) {
        dueNow++
      } else if (diffDays < 1) {
        dueSoon++
      }
    }
  }
  
  const averageAccuracy = accuracyCount > 0 
    ? (totalAccuracy / accuracyCount) * 100 
    : null
  
  return {
    total,
    byState,
    studiedCount,
    totalReviews,
    averageAccuracy,
    dueNow,
    dueSoon
  }
}

/**
 * Displays vocabulary statistics summary.
 * Input: vocabulary array
 * Output: Statistics display component
 */
export function VocabularyStats({ vocabulary }: VocabularyStatsProps) {
  const stats = calculateStats(vocabulary)
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Total Words</div>
              <div className="text-2xl font-semibold">{stats.total}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Studied</div>
              <div className="text-2xl font-semibold">
                {stats.studiedCount}
              </div>
            </div>
          </div>
          
          <div>
            <div className="text-sm text-muted-foreground mb-2">
              By State
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                New: {stats.byState.new}
              </Badge>
              <Badge variant="secondary">
                Learning: {stats.byState.learning}
              </Badge>
              <Badge variant="default">
                Review: {stats.byState.review}
              </Badge>
              <Badge variant="secondary">
                Relearning: {stats.byState.relearning}
              </Badge>
            </div>
          </div>
          
          {stats.averageAccuracy !== null && (
            <div>
              <div className="text-sm text-muted-foreground">
                Average Accuracy
              </div>
              <div className="text-xl font-semibold">
                {stats.averageAccuracy.toFixed(1)}%
              </div>
            </div>
          )}
          
          <div>
            <div className="text-sm text-muted-foreground">
              Total Reviews
            </div>
            <div className="text-xl font-semibold">
              {stats.totalReviews}
            </div>
          </div>
          
          {(stats.dueNow > 0 || stats.dueSoon > 0) && (
            <div>
              <div className="text-sm text-muted-foreground mb-2">
                Due Status
              </div>
              <div className="flex flex-wrap gap-2">
                {stats.dueNow > 0 && (
                  <Badge variant="destructive">
                    Due Now: {stats.dueNow}
                  </Badge>
                )}
                {stats.dueSoon > 0 && (
                  <Badge variant="outline" className="border-yellow-500">
                    Due Soon: {stats.dueSoon}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

