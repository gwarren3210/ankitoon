"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Flashcard } from './flashcard'
import { RatingButtons } from './ratingButtons'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { StudyCard } from '@/lib/study/studyData'
import { FsrsCard, FsrsRating } from '@/lib/study/fsrs'
import { Tables } from '@/types/database.types'

interface StudySessionProps {
  seriesSlug: string
  seriesName: string
  chapter: Tables<'chapters'>
  isAuthenticated: boolean
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
  isAuthenticated
}: StudySessionProps) {
  const router = useRouter()
  const [cards, setCards] = useState<StudyCard[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [cardStartTime, setCardStartTime] = useState(new Date())
  const [ratings, setRatings] = useState<FsrsRating[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sessionCompleted, setSessionCompleted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)



  const currentCard = cards[currentIndex]
  const progress = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0
  const isLastCard = currentIndex === cards.length - 1

  // Start session on mount
  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false)
      return
    }

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
        setSessionId(data.sessionId)
        setCards(data.cards || [])
      } catch (error) {
        console.error('Error starting session:', error)
      } finally {
        setIsLoading(false)
      }
    }

    startSession()
  }, [chapter.id, isAuthenticated])

  // Reset card timer when moving to next card
  useEffect(() => {
    setCardStartTime(new Date())
  }, [currentIndex])

  // Keyboard shortcuts for ratings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Don't handle if submitting
      if (isSubmitting || !currentCard) {
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
  }, [currentCard, isSubmitting])

  // Handle rating submission
  const handleRate = useCallback(async (rating: FsrsRating) => {
    if (!currentCard || !sessionId || isSubmitting) return

    setIsSubmitting(true)

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

      // Update card state with reviewed card
      setCards(prev => prev.map((c, idx) => 
        idx === currentIndex 
          ? { ...c, srsCard: data.card }
          : c
      ))

      // If reAddCard is true (rating 1), add card back to end of queue
      if (data.reAddCard) {
        setCards(prev => [...prev, {
          ...currentCard,
          srsCard: data.card
        }])
      }
      // TODO: custom resort among due cards by due date

      // Move to next card or complete session
      if (isLastCard && !data.reAddCard) {
        await completeSession()
      } else {
        setCurrentIndex(prev => prev + 1)
      }
    } catch (error) {
      console.error('Error submitting rating:', error)
      if (isLastCard) {
        await completeSession()
      } else {
        setCurrentIndex(prev => prev + 1)
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [currentCard, currentIndex, isLastCard, isSubmitting, sessionId])

  // Complete the study session
  const completeSession = async () => {
    if (!sessionId) {
      setSessionCompleted(true)
      return
    }

    try {
      const response = await fetch('/api/study/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to end session')
      }

      const data = await response.json()
      // Session stats are in response but we calculate from ratings for display
    } catch (error) {
      console.error('Error ending session:', error)
      // Still mark as completed so user can continue
    }

    setSessionCompleted(true)
  }


  // Handle session completion actions
  const handleContinue = () => {
    router.push(`/browse/${seriesSlug}`)
  }

  const handleStudyAgain = () => {
    router.refresh() // Reload the page to restart the session
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Loading study session...</p>
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
          All cards in this chapter are up to date, or you haven't started studying yet.
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
      <div className="text-center py-12 space-y-6">
        <div className="text-6xl">🎉</div>
        <div>
          <h3 className="text-2xl font-bold mb-2">Study Session Complete!</h3>
          <p className="text-muted-foreground">
            Great job studying {seriesName} - Chapter {chapter.chapter_number}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-md mx-auto">
          <div className="text-center p-4 rounded-lg bg-muted">
            <div className="text-2xl font-bold">{ratings.length}</div>
            <div className="text-sm text-muted-foreground">Cards Studied</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-muted">
            <div className="text-2xl font-bold">{accuracy}%</div>
            <div className="text-sm text-muted-foreground">Accuracy</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-muted">
            <div className="text-2xl font-bold">{ratings.filter(r => r === 4).length}</div>
            <div className="text-sm text-muted-foreground">Easy</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-muted">
            <div className="text-2xl font-bold">{ratings.filter(r => r === 1).length}</div>
            <div className="text-sm text-muted-foreground">Again</div>
          </div>
        </div>

        <div className="space-x-4">
          <Button onClick={handleContinue}>
            Continue to Chapters
          </Button>
          <Button variant="outline" onClick={handleStudyAgain}>
            Study Again
          </Button>
        </div>
      </div>
    )
  }

  // Main study interface
  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Card {currentIndex + 1} of {cards.length}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Flashcard */}
      <Flashcard
        card={currentCard}
        onRate={handleRate}
        isRevealed={false}
      />

      {/* Rating Buttons (shown after card is revealed) */}
      <RatingButtons
        card={currentCard.srsCard}
        onRate={handleRate}
        disabled={isSubmitting}
      />
    </div>
  )
}
