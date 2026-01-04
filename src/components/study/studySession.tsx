"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Flashcard } from '@/components/study/flashcard'
import { RatingButtons } from '@/components/study/ratingButtons'
import { StudyTips } from '@/components/study/studyTips'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { StudyCard } from '@/lib/study/types'
import { FsrsRating } from '@/lib/study/fsrs'
import { Tables } from '@/types/database.types'
import { sessionStartResponseSchema, rateResponseSchema } from '@/lib/study/schemas'
import { logger } from '@/lib/logger'

interface StudySessionProps {
  seriesSlug: string
  seriesName: string
  chapter: Tables<'chapters'>
}

/**
 * Inserts a card into the cards array and sorts by due date.
 * Input: cards array, card to insert
 * Output: new cards array with card inserted and sorted by due date
 * NOTE: assuming there aren't that many cards in the array, so the sort is not too expensive
 */
function insertCardByDueDate(cards: StudyCard[], cardToInsert: StudyCard, currentIndex: number): StudyCard[] {
  const studiedCards = cards.slice(0, currentIndex + 1)
  const remainingQueue = cards.slice(currentIndex + 1)
  remainingQueue.push(cardToInsert)
  remainingQueue.sort((a, b) => 
    a.srsCard.due.getTime() - b.srsCard.due.getTime()
  )
  return [...studiedCards, ...remainingQueue]
}

/**
 * Main study session component orchestrating the flashcard study flow.
 * Input: series/chapter data, auth status
 * Output: Complete study session with progress tracking
 */
export function StudySession({
  seriesSlug,
  seriesName,
  chapter,
}: StudySessionProps) {
  const router = useRouter()
  const [cards, setCards] = useState<StudyCard[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [cardStartTime, setCardStartTime] = useState(new Date())
  const [ratings, setRatings] = useState<FsrsRating[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sessionCompleted, setSessionCompleted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [revealed, setRevealed] = useState(false)
  const [hasBeenRevealed, setHasBeenRevealed] = useState(false)
  const [lastRating, setLastRating] = useState<FsrsRating | null>(null)

  const currentCard = cards[currentIndex]
  const progress = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0
  const isLastCard = currentIndex === cards.length - 1

  // Start session on mount
  useEffect(() => {
    const startSession = async () => {
      try {
        const response = await fetch('/api/study/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chapterId: chapter.id })
        })

        if (!response.ok) {
          throw new Error('Failed to start session')
        }

        const data = await response.json()
        const validatedData = sessionStartResponseSchema.parse(data)
        setSessionId(validatedData.sessionId)
        setCards(validatedData.cards)
        logger.info({
          chapterId: chapter.id,
          sessionId: validatedData.sessionId,
          cardCount: validatedData.cards.length
        }, 'Study session started successfully')
      } catch (error) {
        logger.error({
          chapterId: chapter.id,
          error: error instanceof Error ? error.message : String(error)
        }, 'Error starting session')
      } finally {
        setIsLoading(false)
      }
    }

    startSession()
  }, [chapter.id])

  // Reset card timer and revealed state when moving to next card
  useEffect(() => {
    setCardStartTime(new Date())
    setRevealed(false)
    setHasBeenRevealed(false)
    setLastRating(null)
  }, [currentIndex])

  // Track when card is first revealed
  useEffect(() => {
    if (revealed && !hasBeenRevealed) {
      setHasBeenRevealed(true)
    }
  }, [revealed, hasBeenRevealed])

  // Complete the study session
  const completeSession = useCallback(async () => {
    if (!sessionId) {
      setSessionCompleted(true)
      return
    }

    // Optimistic update: show completion immediately
    setSessionCompleted(true)

    // End session in background (fire and forget)
    fetch('/api/study/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to end session')
        }
        logger.info({ sessionId }, 'Study session ended successfully')
      })
      .catch((error) => {
        // Log error but don't block UI - session cleanup is best-effort
        logger.error({
          sessionId,
          error: error instanceof Error ? error.message : String(error)
        }, 'Error ending session')
      })
  }, [sessionId])

  // Handle rating submission
  const handleRate = useCallback(async (rating: FsrsRating) => {
    if (!currentCard || !sessionId || isSubmitting || !hasBeenRevealed) return

    setIsSubmitting(true)
    setLastRating(rating)

    try {
      setRatings(prev => [...prev, rating])

      const response = await fetch('/api/study/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          vocabularyId: currentCard.vocabulary.id,
          rating,
          card: currentCard.srsCard
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to submit rating')
      }

      const data = await response.json()
      const validatedData = rateResponseSchema.parse(data)

      // Update card state with reviewed card
      setCards(prev => {
        const updatedCard: StudyCard = {
          ...currentCard,
          srsCard: validatedData.card
        }
        const updatedCards = prev.map((c, idx) => 
          idx === currentIndex 
            ? updatedCard
            : c
        )
        
        // If reAddCard is true (rating 1), insert card in correct position by due date
        if (validatedData.reAddCard) {
          return insertCardByDueDate(updatedCards, updatedCard, currentIndex)
        }
        
        return updatedCards
      })

      // Move to next card or complete session
      logger.debug({
        sessionId,
        vocabularyId: currentCard.vocabulary.id,
        rating,
        isLastCard,
        reAddCard: validatedData.reAddCard
      }, 'Card rated successfully')
      
      if (isLastCard && !validatedData.reAddCard) {
        await completeSession()
      } else {
        setCurrentIndex(prev => prev + 1)
      }
    } catch (error) {
      logger.error({
        sessionId,
        vocabularyId: currentCard?.vocabulary.id,
        rating,
        error: error instanceof Error ? error.message : String(error)
      }, 'Error submitting rating')
      if (isLastCard) {
        await completeSession()
      } else {
        setCurrentIndex(prev => prev + 1)
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [currentCard, currentIndex, isLastCard, isSubmitting, sessionId, hasBeenRevealed, completeSession])

  // Keyboard shortcuts for ratings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Don't handle if submitting, no card, or card hasn't been revealed yet
      if (isSubmitting || !currentCard || !hasBeenRevealed) {
        return
      }

      let rating: FsrsRating | null = null

      // Arrow keys
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        rating = FsrsRating.Again // 1
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        rating = FsrsRating.Hard // 2
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        rating = FsrsRating.Good // 3
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        rating = FsrsRating.Easy // 4
      }
      // Number keys
      else if (e.key === '1') {
        e.preventDefault()
        rating = FsrsRating.Again
      } else if (e.key === '2') {
        e.preventDefault()
        rating = FsrsRating.Hard
      } else if (e.key === '3') {
        e.preventDefault()
        rating = FsrsRating.Good
      } else if (e.key === '4') {
        e.preventDefault()
        rating = FsrsRating.Easy
      }

      if (rating !== null) {
        handleRate(rating)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentCard, isSubmitting, hasBeenRevealed, handleRate])

  // Handle session completion actions
  const handleContinue = () => {
    router.push(`/browse/${seriesSlug}`)
  }

  // Show loading state
  if (isLoading) {
    return <StudyTips />
  }

  // Show empty state if no cards
  if (cards.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📚</div>
        <h3 className="text-xl font-semibold mb-2">No cards to study</h3>
        <p className="text-muted-foreground mb-6">
          All cards in this chapter are up to date, or you haven&apos;t started studying yet.
        </p>
        {/*<p>
          Next card due: {next due date}
        </p>*/}
        <div className="space-x-4">
          <Button onClick={() => router.push(`/browse/${seriesSlug}/${chapter.chapter_number}`)}>
            View Chapter
          </Button>
          <Button variant="outline" onClick={() => router.push(`/browse/${seriesSlug}`)}>
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
          <h3 className="text-xl sm:text-2xl font-bold mb-2">Study Session Complete!</h3>
          <p className="text-sm sm:text-base text-muted-foreground">
            Great job studying {seriesName} - Chapter {chapter.chapter_number}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-md mx-auto">
          <div className="text-center p-3 sm:p-4 rounded-lg bg-muted">
            <div className="text-xl sm:text-2xl font-bold">{ratings.length}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Cards Studied</div>
          </div>
          <div className="text-center p-3 sm:p-4 rounded-lg bg-muted">
            <div className="text-xl sm:text-2xl font-bold">{accuracy}%</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Accuracy</div>
          </div>
          <div className="text-center p-3 sm:p-4 rounded-lg bg-muted">
            <div className="text-xl sm:text-2xl font-bold">{ratings.filter(r => r === 4).length}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Easy</div>
          </div>
          <div className="text-center p-3 sm:p-4 rounded-lg bg-muted">
            <div className="text-xl sm:text-2xl font-bold">{ratings.filter(r => r === 1).length}</div>
            <div className="text-xs sm:text-sm text-muted-foreground">Again</div>
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
        <div className="flex justify-between text-xs sm:text-sm text-muted-foreground">
          <span>Card {currentIndex + 1} of {cards.length}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <Progress value={progress} className="h-1.5 sm:h-2" />
      </div>

      {/* Flashcard */}
      <Flashcard
        card={currentCard}
        onRate={handleRate}
        isRevealed={revealed}
        onRevealedChange={setRevealed}
        hasBeenRevealed={hasBeenRevealed}
      />

      {/* Rating Buttons (shown after card is revealed) */}
      <RatingButtons
        card={currentCard.srsCard}
        onRate={handleRate}
        disabled={isSubmitting || !hasBeenRevealed}
        isRevealed={hasBeenRevealed}
        lastRating={lastRating}
      />
    </div>
  )
}
