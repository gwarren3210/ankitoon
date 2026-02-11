'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Tables } from '@/types/database.types'
import { useLearnSession } from '@/lib/hooks/useLearnSession'
import { useLearnPhase } from '@/lib/hooks/useLearnPhase'
import { useCardTypeFilter } from '@/lib/hooks/useCardTypeFilter'
import { MultipleChoiceCard } from '@/components/learn/multipleChoiceCard'
import { LearnProgress } from '@/components/learn/learnProgress'
import { LearnComplete } from '@/components/learn/learnComplete'
import { LearnSessionSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { CardTypeFilter } from '@/components/ui/cardTypeFilter'

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

  // Card type filter from URL params
  const { filter, setFilter, cardTypeForApi } = useCardTypeFilter()

  // Track if session has started (to disable filter changes)
  const [sessionStarted, setSessionStarted] = useState(false)

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

  // Mark session as started when first card is shown
  useEffect(() => {
    if (currentCard && !sessionStarted) {
      setSessionStarted(true)
    }
  }, [currentCard, sessionStarted])

  // Navigate to study after learning
  const handleStudyNow = useCallback(() => {
    router.push(`/study/${seriesSlug}/${chapter.chapter_number}`)
  }, [router, seriesSlug, chapter.chapter_number])

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
          <CardTypeFilter
            value={filter}
            onChange={setFilter}
            disabled={false}
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
      {/* Card type filter */}
      <div className="flex justify-center">
        <CardTypeFilter
          value={filter}
          onChange={setFilter}
          disabled={sessionStarted}
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
