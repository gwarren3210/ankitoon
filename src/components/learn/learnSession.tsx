'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo } from 'react'
import { Tables } from '@/types/database.types'
import { useLearnSession } from '@/lib/hooks/useLearnSession'
import { useLearnPhase } from '@/lib/hooks/useLearnPhase'
import {
  useCardTypeFilter,
  CardTypeFilterValue
} from '@/lib/hooks/useCardTypeFilter'
import { MultipleChoiceCard } from '@/components/learn/multipleChoiceCard'
import { LearnProgress } from '@/components/learn/learnProgress'
import { LearnComplete } from '@/components/learn/learnComplete'
import { LearnSessionSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterModal } from '@/components/ui/filterModal'

interface LearnSessionProps {
  seriesSlug: string
  chapter: Tables<'chapters'>
}

/**
 * Main learn session component orchestrating the multiple choice flow.
 * Input: series/chapter data
 * Output: Complete learn session with progress tracking
 */
export function LearnSession({ seriesSlug, chapter }: LearnSessionProps) {
  const router = useRouter()
  const pathname = usePathname()

  // Card type filter from URL params
  const { filter, cardTypeForApi } = useCardTypeFilter()

  // Session lifecycle management
  const {
    sessionId: _sessionId,
    cards,
    fallbackDistractors,
    isLoading,
    sessionCompleted,
    completeSession,
    error
  } = useLearnSession({ chapterId: chapter.id, cardType: cardTypeForApi })

  // Learn phase quiz logic
  const {
    currentCard,
    answerOptions,
    handleAnswer,
    feedback,
    dismissFeedback,
    progress,
    isComplete,
    awaitingDismiss
  } = useLearnPhase({
    cards,
    fallbackDistractors,
    requiredCorrect: 2,
    onComplete: (graduatedCards) => {
      completeSession(graduatedCards)
    }
  })

  // Handle keyboard shortcuts (1-4 for answers)
  useEffect(() => {
    if (!currentCard || feedback?.shown) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const keyNum = parseInt(e.key)
      if (keyNum >= 1 && keyNum <= 4 && answerOptions[keyNum - 1]) {
        handleAnswer(answerOptions[keyNum - 1].id)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentCard, answerOptions, handleAnswer, feedback])

  // Handle spacebar to dismiss feedback
  useEffect(() => {
    if (!awaitingDismiss) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        dismissFeedback()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [awaitingDismiss, dismissFeedback])

  // Derive whether user has made progress (answered any cards)
  const hasProgress = useMemo(
    () => progress.graduated > 0 || progress.currentCorrect > 0,
    [progress.graduated, progress.currentCorrect]
  )

  // Navigate to study after learning
  const handleStudyNow = useCallback(() => {
    router.push(`/study/${seriesSlug}/${chapter.chapter_number}`)
  }, [router, seriesSlug, chapter.chapter_number])

  /**
   * Handles filter change by reloading page with new URL.
   * This ensures all hooks reset their state cleanly.
   */
  const handleFilterChange = useCallback(
    (newFilter: CardTypeFilterValue) => {
      const params = new URLSearchParams()
      if (newFilter !== 'all') {
        params.set('type', newFilter)
      }
      const queryString = params.toString()
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname
      // Full page reload ensures clean state reset
      window.location.href = newUrl
    },
    [pathname]
  )

  // Get filter-aware empty state text
  const getEmptyStateText = () => {
    if (filter === 'vocabulary') {
      return {
        title: 'No new words to learn',
        description: "You've already learned all the words in this chapter!"
      }
    }
    if (filter === 'grammar') {
      return {
        title: 'No new grammar to learn',
        description: "You've already learned all the grammar in this chapter!"
      }
    }
    return {
      title: 'No new content to learn',
      description: "You've already learned everything in this chapter!"
    }
  }

  // Show loading state
  if (isLoading) {
    return <LearnSessionSkeleton />
  }

  // Show error state
  if (error) {
    return (
      <EmptyState
        variant="error"
        title="Failed to load learn session"
        description={error}
        action={{
          label: 'Try Again',
          onClick: () => window.location.reload()
        }}
        secondaryAction={{
          label: 'Back to Chapter',
          href: `/browse/${seriesSlug}/${chapter.chapter_number}`
        }}
      />
    )
  }

  // Show empty state if no cards
  if (cards.length === 0) {
    const emptyText = getEmptyStateText()
    return (
      <div className="space-y-6">
        {/* Show filter even when empty so users can switch types */}
        <div className="flex justify-center">
          <FilterModal
            currentFilter={filter}
            onFilterChange={handleFilterChange}
            hasProgress={false}
          />
        </div>
        <EmptyState
          variant="library"
          title={emptyText.title}
          description={emptyText.description}
          action={{
            label: 'Study Now',
            href: `/study/${seriesSlug}/${chapter.chapter_number}`
          }}
          secondaryAction={{
            label: 'Back to Chapter',
            href: `/browse/${seriesSlug}/${chapter.chapter_number}`
          }}
        />
      </div>
    )
  }

  // Show completion screen
  if (isComplete || sessionCompleted) {
    return (
      <LearnComplete
        progress={progress}
        seriesSlug={seriesSlug}
        chapterNumber={chapter.chapter_number}
        onStudyNow={handleStudyNow}
      />
    )
  }

  // Main learn interface
  return (
    <div className="space-y-4 sm:space-y-6 py-4">
      {/* Card type filter modal */}
      <div className="flex justify-center">
        <FilterModal
          currentFilter={filter}
          onFilterChange={handleFilterChange}
          hasProgress={hasProgress}
        />
      </div>

      {/* Progress display */}
      <LearnProgress progress={progress} />

      {/* Multiple choice card */}
      {currentCard && (
        <MultipleChoiceCard
          card={currentCard}
          options={answerOptions}
          onAnswer={handleAnswer}
          feedback={feedback}
          onDismissFeedback={dismissFeedback}
          disabled={awaitingDismiss}
        />
      )}

      {/* Keyboard hint */}
      <div className="text-center text-xs text-muted-foreground">
        Press 1-4 to select an answer
      </div>
    </div>
  )
}
