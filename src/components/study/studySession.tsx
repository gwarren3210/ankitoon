"use client"

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Flashcard } from '@/components/study/flashcard'
import { RatingButtons } from '@/components/study/ratingButtons'
import { SessionComplete } from '@/components/study/sessionComplete'
import { StudyTips } from '@/components/study/studyTips'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { StudySessionSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { CardTypeFilter } from '@/components/ui/cardTypeFilter'
import { Tables } from '@/types/database.types'
import { useStudySession } from '@/lib/hooks/useStudySession'
import { useCardNavigation } from '@/lib/hooks/useCardNavigation'
import { useRatingSubmission } from '@/lib/hooks/useRatingSubmission'
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts'
import { useCardTypeFilter } from '@/lib/hooks/useCardTypeFilter'

interface StudySessionProps {
  seriesSlug: string
  seriesName: string
  chapter: Tables<'chapters'>
}

/**
 * Main study session component orchestrating the flashcard study flow.
 * Input: series/chapter data
 * Output: Complete study session with progress tracking
 */
export function StudySession({
  seriesSlug,
  chapter,
}: StudySessionProps) {
  const router = useRouter()

  // Card type filter from URL params
  const { filter, setFilter, cardTypeForApi } = useCardTypeFilter()

  // Track if session has started (to disable filter changes)
  const [sessionStarted, setSessionStarted] = useState(false)

  // Session lifecycle management
  const {
    sessionId,
    cards,
    isLoading,
    sessionCompleted,
    completeSession,
    updateCards,
    error
  } = useStudySession({ chapterId: chapter.id, cardType: cardTypeForApi })

  // Card navigation and reveal state
  const {
    currentIndex,
    currentItem: currentCard,
    progress,
    isLastItem: isLastCard,
    revealed,
    hasBeenRevealed,
    setRevealed,
    moveToNext
  } = useCardNavigation(cards)

  // Rating submission with optimistic updates
  const {
    handleRate,
    isSubmitting,
    lastRating,
    ratings
  } = useRatingSubmission({
    sessionId,
    currentCard,
    currentIndex,
    isLastCard,
    hasBeenRevealed,
    onCardRated: moveToNext,
    onSessionComplete: completeSession,
    updateCards
  })

  // Keyboard shortcuts for rating
  useKeyboardShortcuts({
    onRate: handleRate,
    enabled: !!currentCard && hasBeenRevealed && !isSubmitting
  })

  // Mark session as started when first card is shown
  useEffect(() => {
    if (currentCard && !sessionStarted) {
      setSessionStarted(true)
    }
  }, [currentCard, sessionStarted])

  // Handle session completion actions
  const handleContinue = () => {
    router.push(`/browse/${seriesSlug}`)
  }

  // Get filter-aware empty state text
  const getEmptyStateText = () => {
    if (filter === 'vocabulary') {
      return {
        title: 'No words to study',
        description: 'All vocabulary cards in this chapter are up to date.'
      }
    }
    if (filter === 'grammar') {
      return {
        title: 'No grammar to study',
        description: 'All grammar cards in this chapter are up to date.'
      }
    }
    return {
      title: 'No cards to study',
      description: 'All cards in this chapter are up to date.'
    }
  }

  // Show loading state with skeleton and tips
  if (isLoading) {
    return (
      <div className="space-y-8">
        <StudySessionSkeleton />
        <StudyTips />
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <EmptyState
        variant="error"
        title="Failed to load study session"
        description={error}
        action={{ label: 'Try Again', onClick: () => window.location.reload() }}
        secondaryAction={{
          label: 'Back to Series',
          href: `/browse/${seriesSlug}`
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
            label: 'View Chapter',
            href: `/browse/${seriesSlug}/${chapter.chapter_number}`
          }}
          secondaryAction={{
            label: 'All Chapters',
            href: `/browse/${seriesSlug}`
          }}
        />
      </div>
    )
  }

  // Show completion screen with celebration
  if (sessionCompleted) {
    return <SessionComplete ratings={ratings} onContinue={handleContinue} />
  }

  // Main study interface
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Card type filter */}
      <div className="flex justify-center">
        <CardTypeFilter
          value={filter}
          onChange={setFilter}
          disabled={sessionStarted}
        />
      </div>

      {/* Progress Bar */}
      <div className="space-y-1 sm:space-y-2">
        <div className="flex justify-between text-xs sm:text-sm
                        text-muted-foreground">
          <span>Card {currentIndex} of {cards.length}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <Progress
          value={progress}
          className="h-1.5 sm:h-2 dark:[&_[data-slot=progress-indicator]]:bg-accent
                     dark:[&_[data-slot=progress]]:bg-accent/20"
        />
      </div>

      {/* Flashcard */}
      {currentCard && (
        <Flashcard
          card={currentCard}
          onRate={handleRate}
          isRevealed={revealed}
          onRevealedChange={setRevealed}
          hasBeenRevealed={hasBeenRevealed}
        />
      )}

      {/* Rating Buttons (shown after card is revealed) */}
      {currentCard && (
        <RatingButtons
          key={currentIndex}
          card={currentCard.srsCard}
          onRate={handleRate}
          disabled={isSubmitting || !hasBeenRevealed}
          isRevealed={hasBeenRevealed}
          lastRating={lastRating}
        />
      )}
    </div>
  )
}
