"use client"

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import {
  motion,
  useSpring,
  useTransform,
  useReducedMotion
} from 'framer-motion'
import confetti from 'canvas-confetti'
import { Button } from '@/components/ui/button'
import { FsrsRating } from '@/lib/study/fsrs'

interface SessionCompleteProps {
  ratings: FsrsRating[]
  onContinue: () => void
}

const CONFETTI_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6']

/**
 * Session completion screen with celebration animations.
 * Input: array of ratings from session, continue callback
 * Output: Animated statistics display with confetti celebration
 */
export function SessionComplete({ ratings, onContinue }: SessionCompleteProps) {
  const hasPlayedConfetti = useRef(false)
  const prefersReducedMotion = useReducedMotion()

  // Calculate stats
  const totalCards = ratings.length
  const correctCards = ratings.filter(r => r >= 3).length
  const accuracy = totalCards > 0
    ? Math.round((correctCards / totalCards) * 100)
    : 0
  const easyCount = ratings.filter(r => r === FsrsRating.Easy).length
  const againCount = ratings.filter(r => r === FsrsRating.Again).length

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

      {/* Header with bounce animation */}
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
          Session complete!
        </h3>
        <p className="text-sm sm:text-base text-muted-foreground">
          Great work! Keep up the momentum.
        </p>
      </motion.div>

      {/* Stats Grid with staggered entrance */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4
                      max-w-md mx-auto">
        <StatCard
          value={totalCards}
          label="Cards Studied"
          delay={0.3}
          prefersReducedMotion={prefersReducedMotion}
        />
        <StatCard
          value={accuracy}
          label="Accuracy"
          suffix="%"
          delay={0.4}
          highlight={accuracy >= 80}
          prefersReducedMotion={prefersReducedMotion}
        />
        <StatCard
          value={easyCount}
          label="Easy"
          delay={0.5}
          colorClass="text-brand-green"
          prefersReducedMotion={prefersReducedMotion}
        />
        <StatCard
          value={againCount}
          label="Again"
          delay={0.6}
          colorClass="text-brand-red"
          prefersReducedMotion={prefersReducedMotion}
        />
      </div>

      {/* Continue Button with entrance */}
      <motion.div
        initial={prefersReducedMotion ? false : { y: 20, opacity: 0 }}
        animate={prefersReducedMotion ? false : { y: 0, opacity: 1 }}
        transition={
          prefersReducedMotion ? undefined : { delay: 0.8 }
        }
      >
        <Button onClick={onContinue} size="lg">
          Continue to Chapters
        </Button>
      </motion.div>
    </motion.div>
  )
}

interface StatCardProps {
  value: number
  label: string
  suffix?: string
  delay?: number
  highlight?: boolean
  colorClass?: string
  prefersReducedMotion: boolean | null
}

/**
 * Animated stat card with counting animation.
 * Input: target value, label, animation delay
 * Output: Card with animated number counting up
 */
function StatCard({
  value,
  label,
  suffix = '',
  delay = 0,
  highlight = false,
  colorClass = '',
  prefersReducedMotion
}: StatCardProps) {
  // Animated counter using spring
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
      className={`
        text-center p-3 sm:p-4 rounded-lg bg-muted
        ${highlight ? 'ring-2 ring-brand-green ring-offset-2 ring-offset-background' : ''}
      `}
    >
      <div className={`text-xl sm:text-2xl font-bold ${colorClass}`}>
        <motion.span>{displayValue}</motion.span>
        {suffix}
      </div>
      <div className="text-xs sm:text-sm text-muted-foreground">
        {label}
      </div>
    </motion.div>
  )
}

/**
 * Fire confetti from both sides of the screen.
 * Uses brand colors for cohesive celebration.
 */
function fireConfetti() {
  const duration = 2000
  const end = Date.now() + duration

  const frame = () => {
    // Fire from left side
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors: CONFETTI_COLORS
    })

    // Fire from right side
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
