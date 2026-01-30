'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  motion,
  useSpring,
  useTransform,
  useReducedMotion
} from 'framer-motion'
import confetti from 'canvas-confetti'
import { Button } from '@/components/ui/button'
import { LearnProgress } from '@/lib/study/types'

interface LearnCompleteProps {
  progress: LearnProgress
  seriesSlug: string
  chapterNumber: number
  onStudyNow?: () => void
}

const CONFETTI_COLORS = ['#10b981', '#f59e0b', '#8b5cf6', '#3b82f6', '#ec4899']

/**
 * Learn session completion screen with celebration.
 * Shows stats and offers options to study or return to chapter.
 * Input: progress stats, navigation info
 * Output: Animated completion screen with confetti
 */
export function LearnComplete({
  progress,
  seriesSlug,
  chapterNumber,
  onStudyNow
}: LearnCompleteProps) {
  const hasPlayedConfetti = useRef(false)
  const prefersReducedMotion = useReducedMotion()

  // Trigger confetti on mount
  useEffect(() => {
    if (hasPlayedConfetti.current || prefersReducedMotion) return
    hasPlayedConfetti.current = true
    fireConfetti()
  }, [prefersReducedMotion])

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
      animate={prefersReducedMotion ? false : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="text-center py-8 sm:py-12 space-y-4 sm:space-y-6 px-4"
    >
      {/* Ttori celebration illustration */}
      <motion.div
        initial={prefersReducedMotion ? false : { scale: 0.8, opacity: 0 }}
        animate={prefersReducedMotion ? false : { scale: 1, opacity: 1 }}
        transition={
          prefersReducedMotion
            ? undefined
            : { delay: 0.1, type: 'spring', stiffness: 200, damping: 15 }
        }
        className="relative mb-2"
      >
        <Image
          src="/ttori/celebration.png"
          alt="Ttori celebrating with confetti"
          width={160}
          height={160}
          className="object-contain mx-auto"
          priority
        />
      </motion.div>

      {/* Header */}
      <motion.div
        initial={prefersReducedMotion ? false : { y: -20, opacity: 0 }}
        animate={prefersReducedMotion ? false : { y: 0, opacity: 1 }}
        transition={
          prefersReducedMotion
            ? undefined
            : { delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }
        }
      >
        <h3 className="text-xl sm:text-2xl font-bold mb-2">
          Words Learned!
        </h3>
        <p className="text-sm sm:text-base text-muted-foreground">
          Great job! These words are now ready for review.
        </p>
      </motion.div>

      {/* Stats */}
      <div className="flex justify-center gap-4 max-w-xs mx-auto">
        <StatCard
          value={progress.graduated}
          label="Words Learned"
          delay={0.3}
          colorClass="text-green-500"
          prefersReducedMotion={prefersReducedMotion}
        />
      </div>

      {/* Action Buttons */}
      <motion.div
        initial={prefersReducedMotion ? false : { y: 20, opacity: 0 }}
        animate={prefersReducedMotion ? false : { y: 0, opacity: 1 }}
        transition={prefersReducedMotion ? undefined : { delay: 0.5 }}
        className="flex flex-col sm:flex-row gap-3 justify-center pt-2"
      >
        {onStudyNow && (
          <Button onClick={onStudyNow} size="lg">
            Study Now
          </Button>
        )}
        <Button variant="outline" size="lg" asChild>
          <Link href={`/browse/${seriesSlug}/${chapterNumber}`}>
            Back to Chapter
          </Link>
        </Button>
      </motion.div>

      {/* Encouragement text */}
      <motion.p
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={prefersReducedMotion ? false : { opacity: 1 }}
        transition={prefersReducedMotion ? undefined : { delay: 0.7 }}
        className="text-xs text-muted-foreground"
      >
        Study these words soon to strengthen your memory!
      </motion.p>
    </motion.div>
  )
}

interface StatCardProps {
  value: number
  label: string
  delay?: number
  colorClass?: string
  prefersReducedMotion: boolean | null
}

/**
 * Animated stat card with counting animation.
 */
function StatCard({
  value,
  label,
  delay = 0,
  colorClass = '',
  prefersReducedMotion
}: StatCardProps) {
  const springValue = useSpring(0, {
    stiffness: 100,
    damping: 30,
    mass: 1
  })

  const displayValue = useTransform(springValue, (v) => Math.round(v))

  useEffect(() => {
    if (prefersReducedMotion) {
      springValue.jump(value)
      return
    }

    const timer = setTimeout(() => {
      springValue.set(value)
    }, delay * 1000)

    return () => clearTimeout(timer)
  }, [value, delay, springValue, prefersReducedMotion])

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { scale: 0.8, opacity: 0 }}
      animate={prefersReducedMotion ? false : { scale: 1, opacity: 1 }}
      transition={
        prefersReducedMotion
          ? undefined
          : { delay, type: 'spring', stiffness: 200, damping: 15 }
      }
      className="text-center p-4 sm:p-6 rounded-lg bg-muted min-w-[120px]"
    >
      <div className={`text-3xl sm:text-4xl font-bold ${colorClass}`}>
        <motion.span>{displayValue}</motion.span>
      </div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </motion.div>
  )
}

/**
 * Fire confetti celebration.
 */
function fireConfetti() {
  const duration = 2000
  const end = Date.now() + duration

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors: CONFETTI_COLORS
    })

    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors: CONFETTI_COLORS
    })

    if (Date.now() < end) {
      requestAnimationFrame(frame)
    }
  }

  frame()
}
