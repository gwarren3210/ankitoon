"use client"

import { useRouter } from 'next/navigation'
import { Flashcard } from '@/components/study/flashcard'
import { RatingButtons } from '@/components/study/ratingButtons'
import { StudyTips } from '@/components/study/studyTips'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tables } from '@/types/database.types'
import { useStudySession } from '@/lib/hooks/useStudySession'
import { useCardNavigation } from '@/lib/hooks/useCardNavigation'
import { useRatingSubmission } from '@/lib/hooks/useRatingSubmission'
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts'

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

  // Session lifecycle management
  const {
    sessionId,
    cards,
    isLoading,
    sessionCompleted,
    completeSession,
    updateCards,
    error
  } = useStudySession({ chapterId: chapter.id })

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

  // Handle session completion actions
  const handleContinue = () => {
    router.push(`/browse/${seriesSlug}`)
  }

  // Show loading state
  if (isLoading) {
    return <StudyTips />
  }

  // Show error state
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">:(</div>
        <h3 className="text-xl font-semibold mb-2">Failed to load study session</h3>
        <p className="text-muted-foreground mb-6">{error}</p>
        <div className="space-x-4">
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/browse/${seriesSlug}`)}
          >
            Back to Series
          </Button>
        </div>
      </div>
    )
  }

  // Show empty state if no cards
  if (cards.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📚</div>
        <h3 className="text-xl font-semibold mb-2">No cards to study</h3>
        <p className="text-muted-foreground mb-6">
          All cards in this chapter are up to date, or you haven&apos;t
          started studying yet.
        </p>
        <div className="space-x-4">
          <Button
            onClick={() =>
              router.push(`/browse/${seriesSlug}/${chapter.chapter_number}`)
            }
          >
            View Chapter
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/browse/${seriesSlug}`)}
          >
            All Chapters
          </Button>
        </div>
      </div>
    )
  }

  // Show completion screen
  if (sessionCompleted) {
    const accuracy = ratings.length > 0
      ? Math.round((ratings.filter(r => r >= 3).length / ratings.length) * 100)
      : 0

    return (
      <div className="text-center py-8 sm:py-12 space-y-4 sm:space-y-6 px-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-bold mb-2">
            Session complete
          </h3>
          <p className="text-sm sm:text-base text-muted-foreground">
            {ratings.length} cards reviewed. {accuracy}% accuracy.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4
                        max-w-md mx-auto">
          <div className="text-center p-3 sm:p-4 rounded-lg bg-muted">
            <div className="text-xl sm:text-2xl font-bold">
              {ratings.length}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              Cards Studied
            </div>
          </div>
          <div className="text-center p-3 sm:p-4 rounded-lg bg-muted">
            <div className="text-xl sm:text-2xl font-bold">{accuracy}%</div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              Accuracy
            </div>
          </div>
          <div className="text-center p-3 sm:p-4 rounded-lg bg-muted">
            <div className="text-xl sm:text-2xl font-bold">
              {ratings.filter(r => r === 4).length}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              Easy
            </div>
          </div>
          <div className="text-center p-3 sm:p-4 rounded-lg bg-muted">
            <div className="text-xl sm:text-2xl font-bold">
              {ratings.filter(r => r === 1).length}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              Again
            </div>
          </div>
        </div>

        <div className="space-x-4">
          <Button onClick={handleContinue}>
            Continue to Chapters
          </Button>
        </div>
      </div>
    )
  }

  // Main study interface
  return (
    <div className="space-y-4 sm:space-y-6">
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
