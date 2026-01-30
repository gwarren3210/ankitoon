'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LearnCard, AnswerOption, LearnFeedback } from '@/lib/study/types'
import { cn } from '@/lib/utils'

interface MultipleChoiceCardProps {
  card: LearnCard
  options: AnswerOption[]
  onAnswer: (optionId: string) => void
  feedback: LearnFeedback | null
  onDismissFeedback: () => void
  disabled?: boolean
}

/**
 * Multiple choice card for learn phase.
 * Shows Korean term with 4 answer options in a 2x2 grid.
 * Input: card data, answer options, callbacks
 * Output: Interactive card with answer buttons and feedback
 */
export function MultipleChoiceCard({
  card,
  options,
  onAnswer,
  feedback,
  onDismissFeedback,
  disabled = false
}: MultipleChoiceCardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Reset selection when card changes - this pattern is intentional
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setSelectedId(null)
  }, [card.srsCardId])

  const handleOptionClick = (option: AnswerOption) => {
    if (disabled || feedback?.shown) return
    setSelectedId(option.id)
    onAnswer(option.id)
  }

  const getOptionStyles = (option: AnswerOption) => {
    if (!feedback?.shown) {
      // No feedback yet - show neutral or selected state
      return cn(
        'border-2 transition-all duration-200',
        selectedId === option.id
          ? 'border-primary bg-primary/10'
          : 'border-border bg-card hover:border-primary/50 hover:bg-accent/50'
      )
    }

    // Feedback is shown - highlight correct/incorrect
    if (option.isCorrect) {
      return 'border-2 border-green-500 bg-green-500/20'
    }

    if (selectedId === option.id && !option.isCorrect) {
      return 'border-2 border-red-500 bg-red-500/20'
    }

    return 'border-2 border-border bg-card opacity-50'
  }

  return (
    <div className="w-full max-w-lg mx-auto px-4">
      {/* Question Card */}
      <motion.div
        key={card.srsCardId}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-xl border-2 border-border bg-card shadow-lg p-6
                   mb-6"
      >
        {/* Card Type Badge */}
        <CardTypeBadge cardType={card.cardType} />

        {/* Korean Term */}
        <div className="text-center space-y-3 pt-4">
          <div className="text-4xl font-bold text-primary font-korean">
            {card.term}
          </div>

          {/* Example Sentence */}
          {card.displayExample && (
            <div className="text-sm text-muted-foreground font-korean-light">
              &quot;{card.displayExample}&quot;
            </div>
          )}
        </div>
      </motion.div>

      {/* Answer Options - 2x2 Grid */}
      <div className="grid grid-cols-2 gap-3">
        {options.map((option, index) => (
          <motion.button
            key={option.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => handleOptionClick(option)}
            disabled={disabled || feedback?.shown}
            className={cn(
              'relative rounded-lg p-4 text-center min-h-[80px]',
              'flex items-center justify-center',
              'text-sm sm:text-base font-medium',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              'disabled:cursor-not-allowed',
              getOptionStyles(option)
            )}
          >
            {/* Keyboard shortcut hint */}
            <span
              className="absolute top-2 left-2 text-xs text-muted-foreground
                         opacity-50"
            >
              {index + 1}
            </span>

            {/* Answer text */}
            <span className="px-2">{option.text}</span>

            {/* Correct/Incorrect indicator */}
            {feedback?.shown && option.isCorrect && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-2 right-2 text-green-500"
              >
                ✓
              </motion.span>
            )}
            {feedback?.shown &&
              selectedId === option.id &&
              !option.isCorrect && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2 text-red-500"
                >
                  ✗
                </motion.span>
              )}
          </motion.button>
        ))}
      </div>

      {/* Wrong Answer Feedback Overlay */}
      <AnimatePresence>
        {feedback?.shown && !feedback.isCorrect && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-6"
          >
            <button
              onClick={onDismissFeedback}
              className="w-full p-4 rounded-lg bg-muted border border-border
                         text-center space-y-2 hover:bg-accent transition-colors"
            >
              <div className="text-sm text-muted-foreground">
                Correct answer:
              </div>
              <div className="text-lg font-medium text-foreground">
                {feedback.correctAnswer}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Tap to continue
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Badge indicating card type (Vocab/Grammar).
 */
function CardTypeBadge({ cardType }: { cardType: string }) {
  const isGrammar = cardType === 'grammar'

  return (
    <div
      className={cn(
        'absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-medium',
        isGrammar
          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
      )}
    >
      {isGrammar ? 'Grammar' : 'Vocab'}
    </div>
  )
}
