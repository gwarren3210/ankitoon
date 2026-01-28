# UI/UX Analysis #3: Micro-interactions & Animations

**Severity:** HIGH (Impact on user engagement and retention)
**Impact:** High - Directly affects perceived app quality and learning motivation
**Effort:** ~6 hours
**Status:** ✅ COMPLETED (2026-01-12)
**Affected Files:**
- `src/components/study/flashcard.tsx`
- `src/components/study/studySession.tsx`
- `src/components/study/ratingButtons.tsx`
- `src/components/study/sessionComplete.tsx` (NEW)
- `src/app/globals.css`

---

## Implementation Summary

### What Was Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| 3D Flashcard Flip | ✅ Done | CSS `rotateY` + `preserve-3d` with spring physics |
| Session Celebration | ✅ Done | Confetti burst + animated stat counters |
| Button Spring Animations | ✅ Done | Framer Motion `whileHover`/`whileTap` |
| Page Transitions | ⏸ Deferred | Lower priority, complex with App Router |

### Files Modified

1. **`src/components/study/flashcard.tsx`** - Complete rewrite
   - Restructured with outer (swipe) and inner (flip) containers
   - Spring physics rotation via `useSpring`
   - Both faces always rendered with `backface-hidden`

2. **`src/components/study/ratingButtons.tsx`** - Enhanced
   - Replaced static buttons with `motion.button`
   - Added spring physics (`stiffness: 400, damping: 17`)
   - Muted colors when disabled (`bg-brand-*/40`)
   - Staggered entrance animations

3. **`src/components/study/sessionComplete.tsx`** - NEW FILE
   - Confetti celebration using `canvas-confetti`
   - Animated stat counters with `useSpring` + `useTransform`
   - Staggered card entrances
   - Full reduced motion support

4. **`src/components/study/studySession.tsx`** - Integration
   - Added `<SessionComplete>` component
   - Added `key={currentIndex}` to RatingButtons (animation state fix)

5. **`src/app/globals.css`** - 3D CSS utilities
   - `.perspective-1000`, `.preserve-3d`, `.backface-hidden`
   - `.rotate-y-180`, `.will-change-transform`
   - Reduced motion overrides

### Packages Installed

```bash
bun add canvas-confetti
bun add -D @types/canvas-confetti
```

---

## Key Implementation Insights

### 1. Separating Transform Concerns

The flashcard needed both swipe transforms AND flip rotation. These cannot be
combined on a single element because swipe uses `translate3d` while flip uses
`rotateY`. Solution: nested containers.

```
Outer div: style={{ transform: swipeTransform }}  ← Handles drag/swipe
  Inner div: style={{ rotateY }}                   ← Handles 3D flip
    Front face: backface-hidden
    Back face: backface-hidden + rotateY(180deg)
```

### 2. React Keys for Animation State Reset

**Problem:** After rating a card, the scale animation from `whileTap` persisted
to the next card (button appeared enlarged).

**Root Cause:** Framer Motion preserves animation state across re-renders.

**Solution:** Add `key={currentIndex}` to RatingButtons in studySession.tsx.
This forces React to unmount and remount the component on card change,
resetting all animation state.

```typescript
<RatingButtons
  key={currentIndex}  // Forces remount → resets animation state
  card={currentCard.srsCard}
  onRate={handleRate}
  ...
/>
```

### 3. Muted Colors vs Opacity

**Original approach:** `opacity-50` when disabled
**Problem:** Colors remained vibrant, just semi-transparent

**Final approach:** `bg-brand-red/40` (Tailwind opacity modifier)
**Result:** Colors are muted but still visible, clearly indicating disabled state

### 4. Ring Styling in Dark Mode

**Problem:** `ring-white` created jarring white border in dark mode
**Solution:** Removed the ring entirely - button press animation provides
sufficient feedback, and the ring persisted awkwardly between cards

---

## Lessons Learned

### What Worked Well

1. **Framer Motion's `useSpring`** - Provides smooth, physics-based animations
   with minimal configuration. The `stiffness`/`damping`/`mass` model is
   intuitive.

2. **CSS 3D transforms** - Pure CSS for backface hiding and rotation is
   performant and well-supported. No need for JS-based 3D.

3. **`useReducedMotion`** - Framer Motion's built-in hook made accessibility
   trivial to implement.

4. **canvas-confetti** - Lightweight, performant, and easy to customize.
   No need for custom canvas implementation.

### What Required Iteration

1. **Disabled button styling** - Went through 3 iterations:
   - `opacity-50` → too vibrant
   - `bg-muted text-muted-foreground` → user wanted colors visible
   - `bg-brand-*/40` → final solution

2. **Animation state persistence** - The `key` prop solution wasn't obvious.
   First tried adding `scale: 1` to animate prop, which helped but didn't
   fully fix the issue.

3. **JSX template literal nesting** - Complex conditional classes in template
   literals caused parsing errors. Solution: extract to variables before JSX.

### Deferred Work

**Page Transitions** were deferred for these reasons:
- Next.js App Router + AnimatePresence has known complexity
- Lower impact than other animations
- Consider `next-view-transitions` package for future implementation

---

## Problem Description

AnkiToon's study experience lacks the **delightful micro-interactions** that
make learning apps feel polished and engaging. While the app has functional
swipe gestures and basic entrance animations, it's missing the tactile
feedback that transforms routine studying into an enjoyable experience.

### Current State Analysis

#### What Exists (Strengths)

1. **Staggered Entrance Animations** - Grid components use Framer Motion well:
   ```typescript
   // src/components/browse/seriesGrid.tsx (lines 35-40)
   <motion.div
     initial={{ opacity: 0, y: 10 }}
     animate={{ opacity: 1, y: 0 }}
     transition={{ delay: index * 0.05 }}
   >
   ```

2. **Swipe Gestures** - Flashcard supports directional swiping with visual
   feedback via progress circles

3. **Basic Hover States** - Buttons have color transitions on hover

#### What's Missing (Problems)

1. **No 3D Flip Animation**
   - Card reveal is a simple content swap (no visual flip)
   - Users lose spatial context between front/back
   - Feels flat and unengaging

2. **Static Session Completion**
   - Session ends with plain text statistics
   - No celebration, no dopamine reward
   - Missed opportunity to reinforce positive behavior

3. **Minimal Button Feedback**
   - Rating buttons have hover color change only
   - No press/tap animation (scale, spring physics)
   - Buttons feel "dead" on mobile where hover doesn't exist

4. **No Page Transitions**
   - Routes swap instantly (jarring)
   - No AnimatePresence between views
   - App feels disconnected

---

## Why Micro-interactions Matter

### The Psychology of Learning Apps

Research shows that **micro-interactions directly impact learning outcomes**:

1. **Immediate Feedback Loop**
   - Users need instant confirmation that their action registered
   - Delays > 100ms feel "broken" to users
   - Animations bridge the perception gap

2. **Dopamine & Habit Formation**
   - Small rewards (celebrations, animations) trigger dopamine release
   - This reinforces the study habit loop
   - Apps like Duolingo excel here (streak flames, XP animations)

3. **Spatial Memory**
   - 3D flip helps users remember "front = question, back = answer"
   - Physical metaphor improves recall
   - Flat swaps break mental model

4. **Perceived Quality**
   - Studies show users rate apps with good animations as more "reliable"
   - Even if functionality is identical
   - First impressions form in <50ms

### AnkiToon's Specific Needs

For a **flashcard learning app**, these interactions are critical:

```
Card Flip  → "I'm revealing the answer" (anticipation)
Button Press → "My rating was recorded" (confirmation)
Session End → "I accomplished something!" (reward)
Page Change → "I'm moving to a new context" (orientation)
```

---

## Implementation Requirements

### Tool Breakdown

| Tool | Percentage | Tasks |
|------|:----------:|-------|
| **Claude Code** | 100% | All implementation |
| **Nanabanana Pro** | — | Not needed |
| **Human Decision** | — | Not needed |

### Fully Automatable

This entire issue can be implemented by Claude Code without any external
input or decisions. All tasks are pure code:

- **3D Flip Animation**: CSS transforms (`rotateY`, `preserve-3d`)
- **Confetti Celebration**: `canvas-confetti` package or custom canvas
- **Button Animations**: Framer Motion spring physics
- **Page Transitions**: `AnimatePresence` wrapper component

### No Blockers

Implementation can begin immediately. No design decisions, image assets,
or human input required.

### Implementation Order

```
Priority 1 (Highest Impact):
├── Rating button spring animations (1h)
└── Session completion celebration (2h)

Priority 2 (Core Experience):
└── 3D flashcard flip animation (2h)

Priority 3 (Polish):
├── AnimatedButton component (0.5h)
└── Page transitions (0.5h)
```

### Dependencies

- Framer Motion (already installed)
- `canvas-confetti` package (needs installation: `bun add canvas-confetti`)

### Start Command

This issue is ready for immediate implementation:
```bash
# Install confetti package
bun add canvas-confetti

# Then implement in order:
# 1. src/components/study/ratingButtons.tsx (spring animations)
# 2. src/components/study/studySession.tsx (confetti)
# 3. src/components/study/flashcard.tsx (3D flip)
# 4. src/components/ui/animatedButton.tsx (new component)
# 5. src/app/template.tsx (page transitions)
```

---

## Recommended Solutions

### Solution 1: 3D CSS Flip Animation for Flashcard

**Priority:** CRITICAL
**Effort:** 2 hours

Replace the current content swap with a true 3D card flip using CSS
`transform: rotateY()` and `transform-style: preserve-3d`.

#### Implementation

Create new file `src/components/study/flashcard3D.tsx`:

```typescript
"use client"

import { useRef, useState } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'
import { StudyCard } from '@/lib/study/types'
import { FsrsRating } from '@/lib/study/fsrs'
import { useSwipeGestures } from '@/lib/hooks/useSwipeGestures'

interface Flashcard3DProps {
  card: StudyCard
  onRate: (rating: FsrsRating) => void
  isRevealed: boolean
  onRevealedChange: (revealed: boolean) => void
  hasBeenRevealed: boolean
}

const SWIPE_THRESHOLD = 50
const FLIP_DURATION = 0.6

/**
 * 3D flashcard component with flip animation and swipe gestures.
 * Input: card data, rating callback, reveal state
 * Output: Animated 3D flashcard with term/definition flip
 */
export function Flashcard3D({
  card,
  onRate,
  isRevealed,
  onRevealedChange,
  hasBeenRevealed
}: Flashcard3DProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [isFlipping, setIsFlipping] = useState(false)

  // Spring physics for smooth rotation
  const rotateY = useSpring(isRevealed ? 180 : 0, {
    stiffness: 300,
    damping: 30,
    mass: 1
  })

  // Swipe gesture handling
  const {
    handlers,
    swipeDirection,
    swipeDistance,
    swipeColorClass,
    transform: swipeTransform,
    isAnimating,
    isDragging,
    hasSwiped,
    threshold
  } = useSwipeGestures({
    threshold: SWIPE_THRESHOLD,
    onSwipe: onRate,
    enabled: hasBeenRevealed
  })

  /**
   * Handles card click to trigger flip animation
   */
  const handleCardClick = () => {
    if (isDragging || hasSwiped || isFlipping) return

    setIsFlipping(true)
    onRevealedChange(!isRevealed)

    // Reset flipping state after animation
    setTimeout(() => setIsFlipping(false), FLIP_DURATION * 1000)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px]
                    sm:min-h-[400px] px-4">

      {/* 3D Flashcard Container */}
      <div
        ref={cardRef}
        className={`
          relative w-full max-w-md h-56 sm:h-64 cursor-pointer select-none
          ${isAnimating ? 'animate-fade-out' : ''}
        `}
        style={{
          perspective: '1000px',
          transform: swipeTransform
        }}
        onClick={handleCardClick}
        {...handlers}
      >
        {/* Card Inner - This rotates */}
        <motion.div
          className="relative w-full h-full"
          style={{
            transformStyle: 'preserve-3d',
            rotateY
          }}
        >
          {/* Front Face - Korean Term */}
          <div
            className="absolute inset-0 rounded-lg border-2 border-border
                       bg-card shadow-lg backface-hidden"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="flex flex-col items-center justify-center h-full
                            p-6 text-center">
              <div className="space-y-4">
                <div className="text-3xl font-bold text-primary">
                  {card.vocabulary.term}
                </div>
                <div className="text-sm text-muted-foreground">
                  Tap or press Space to reveal
                </div>
              </div>
            </div>
          </div>

          {/* Back Face - English Definition */}
          <div
            className="absolute inset-0 rounded-lg border-2 border-border
                       bg-card shadow-xl backface-hidden"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)'
            }}
          >
            <div className="flex flex-col items-center justify-center h-full
                            p-6 text-center">
              <div className="space-y-4">
                <div className="text-xl font-medium text-foreground">
                  {card.vocabulary.definition}
                </div>
                {card.displayExample && (
                  <div className="text-sm italic text-muted-foreground">
                    &quot;{card.displayExample}&quot;
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Swipe Indicator Overlay */}
        {swipeDirection && hasBeenRevealed && (
          <SwipeIndicator
            direction={swipeDirection}
            distance={swipeDistance}
            threshold={threshold}
            colorClass={swipeColorClass}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Swipe indicator with progress circle
 */
function SwipeIndicator({
  direction,
  distance,
  threshold,
  colorClass
}: {
  direction: 'left' | 'right' | 'up' | 'down'
  distance: number
  threshold: number
  colorClass: string
}) {
  const progress = Math.min(distance / threshold, 1)
  const circumference = 2 * Math.PI * 28

  const iconMap = {
    left: 'x',
    right: 'check',
    up: 'check',
    down: 'x'
  }

  return (
    <div className="absolute top-4 left-4 pointer-events-none z-10">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
          {/* Background circle */}
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-white/20"
          />
          {/* Progress circle */}
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            className={`transition-all duration-100 ${colorClass}`}
          />
        </svg>
        {/* Icon in center */}
        <div className={`absolute inset-0 flex items-center justify-center
                         text-2xl font-bold ${colorClass}`}>
          {iconMap[direction] === 'check' ? '\u2713' : '\u2717'}
        </div>
      </div>
    </div>
  )
}
```

#### CSS Required

Add to `src/app/globals.css`:

```css
/* 3D Flip Animation Support */
.backface-hidden {
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}

/* GPU acceleration for smooth flips */
.preserve-3d {
  transform-style: preserve-3d;
}

/* Prevent flickering during animation */
.flip-card {
  -webkit-transform-style: preserve-3d;
  transform-style: preserve-3d;
  will-change: transform;
}
```

---

### Solution 2: Celebration Animation on Session Completion

**Priority:** HIGH
**Effort:** 1.5 hours

Add confetti burst and stat counter animations when a study session completes.

#### Option A: Using canvas-confetti (Recommended)

Install the package:
```bash
bun add canvas-confetti
bun add -D @types/canvas-confetti
```

Create `src/components/study/sessionComplete.tsx`:

```typescript
"use client"

import { useEffect, useRef } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Button } from '@/components/ui/button'
import { FsrsRating } from '@/lib/study/fsrs'

interface SessionCompleteProps {
  ratings: FsrsRating[]
  onContinue: () => void
}

/**
 * Session completion screen with celebration animations.
 * Input: array of ratings from session, continue callback
 * Output: Animated statistics display with confetti
 */
export function SessionComplete({ ratings, onContinue }: SessionCompleteProps) {
  const hasPlayedConfetti = useRef(false)

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
    if (hasPlayedConfetti.current) return
    hasPlayedConfetti.current = true

    // Fire confetti with AnkiToon colors
    const duration = 2000
    const end = Date.now() + duration

    const colors = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors
      })

      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }

    frame()
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="text-center py-8 sm:py-12 space-y-4 sm:space-y-6 px-4"
    >
      {/* Header with bounce animation */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
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
        />
        <StatCard
          value={accuracy}
          label="Accuracy"
          suffix="%"
          delay={0.4}
          highlight={accuracy >= 80}
        />
        <StatCard
          value={easyCount}
          label="Easy"
          delay={0.5}
          colorClass="text-brand-green"
        />
        <StatCard
          value={againCount}
          label="Again"
          delay={0.6}
          colorClass="text-brand-red"
        />
      </div>

      {/* Continue Button with entrance */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="space-x-4"
      >
        <Button onClick={onContinue} size="lg">
          Continue to Chapters
        </Button>
      </motion.div>
    </motion.div>
  )
}

/**
 * Animated stat card with counting animation
 */
function StatCard({
  value,
  label,
  suffix = '',
  delay = 0,
  highlight = false,
  colorClass = ''
}: {
  value: number
  label: string
  suffix?: string
  delay?: number
  highlight?: boolean
  colorClass?: string
}) {
  // Animated counter using spring
  const springValue = useSpring(0, {
    stiffness: 100,
    damping: 30,
    mass: 1
  })

  const displayValue = useTransform(springValue, (v) => Math.round(v))

  useEffect(() => {
    const timer = setTimeout(() => {
      springValue.set(value)
    }, delay * 1000)
    return () => clearTimeout(timer)
  }, [value, delay, springValue])

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay, type: 'spring', stiffness: 200 }}
      className={`
        text-center p-3 sm:p-4 rounded-lg bg-muted
        ${highlight ? 'ring-2 ring-brand-green ring-offset-2' : ''}
      `}
    >
      <motion.div
        className={`text-xl sm:text-2xl font-bold ${colorClass}`}
      >
        <motion.span>{displayValue}</motion.span>
        {suffix}
      </motion.div>
      <div className="text-xs sm:text-sm text-muted-foreground">
        {label}
      </div>
    </motion.div>
  )
}
```

#### Option B: Custom Confetti (No Dependencies)

If you prefer no external dependencies, create
`src/components/ui/confetti.tsx`:

```typescript
"use client"

import { useEffect, useRef, useCallback } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  rotation: number
  rotationSpeed: number
  opacity: number
}

interface ConfettiProps {
  active: boolean
  duration?: number
  particleCount?: number
}

/**
 * Custom confetti component using canvas.
 * Input: active state, duration, particle count
 * Output: Canvas-based confetti animation
 */
export function Confetti({
  active,
  duration = 2000,
  particleCount = 150
}: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const particlesRef = useRef<Particle[]>([])

  const colors = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6']

  const createParticle = useCallback((canvas: HTMLCanvasElement): Particle => {
    return {
      x: Math.random() * canvas.width,
      y: -20,
      vx: (Math.random() - 0.5) * 8,
      vy: Math.random() * 3 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 10 + 5,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      opacity: 1
    }
  }, [])

  const animate = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    particlesRef.current = particlesRef.current.filter(p => {
      // Update position
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.1 // gravity
      p.rotation += p.rotationSpeed
      p.opacity -= 0.005

      // Draw particle
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate((p.rotation * Math.PI) / 180)
      ctx.globalAlpha = Math.max(0, p.opacity)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size / 3)
      ctx.restore()

      return p.y < canvas.height + 50 && p.opacity > 0
    })

    if (particlesRef.current.length > 0) {
      animationRef.current = requestAnimationFrame(animate)
    }
  }, [])

  useEffect(() => {
    if (!active) return

    const canvas = canvasRef.current
    if (!canvas) return

    // Set canvas size
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // Create initial particles
    particlesRef.current = Array.from(
      { length: particleCount },
      () => createParticle(canvas)
    )

    // Start animation
    animate()

    // Add more particles over time
    const interval = setInterval(() => {
      if (particlesRef.current.length < particleCount * 2) {
        particlesRef.current.push(
          ...Array.from({ length: 10 }, () => createParticle(canvas))
        )
      }
    }, 100)

    // Stop after duration
    const timeout = setTimeout(() => {
      clearInterval(interval)
    }, duration)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [active, duration, particleCount, createParticle, animate])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ width: '100vw', height: '100vh' }}
    />
  )
}
```

---

### Solution 3: Button Press Animations with Spring Physics

**Priority:** MEDIUM
**Effort:** 1 hour

Add tactile press animations to rating buttons and the base button component.

#### Update Rating Buttons

Replace in `src/components/study/ratingButtons.tsx`:

```typescript
"use client"

import { motion } from 'framer-motion'
import { FsrsCard, FsrsRating, getIntervalPreviews } from '@/lib/study/fsrs'

interface RatingButtonsProps {
  card: FsrsCard
  onRate: (rating: FsrsRating) => void
  disabled?: boolean
  isRevealed?: boolean
  lastRating?: FsrsRating | null
}

// Spring animation variants for buttons
const buttonVariants = {
  idle: { scale: 1 },
  hover: { scale: 1.05 },
  tap: { scale: 0.95 },
  disabled: { scale: 1, opacity: 0.5 }
}

const springTransition = {
  type: 'spring',
  stiffness: 400,
  damping: 17
}

/**
 * Rating buttons component with spring physics animations.
 * Input: current card state, rating callback, disabled state
 * Output: Four animated rating buttons with FSRS interval previews
 */
export function RatingButtons({
  card,
  onRate,
  disabled = false,
  isRevealed = false,
  lastRating = null
}: RatingButtonsProps) {
  const intervalPreviews = getIntervalPreviews(card)
  const isDisabled = disabled || !isRevealed

  const ratingOptions = [
    {
      rating: FsrsRating.Again,
      label: 'Again',
      color: 'bg-brand-red',
      hoverColor: 'hover:bg-brand-red/90',
      interval: intervalPreviews[FsrsRating.Again],
      keyboardShortcut: '1 or left-arrow'
    },
    {
      rating: FsrsRating.Hard,
      label: 'Hard',
      color: 'bg-brand-orange',
      hoverColor: 'hover:bg-brand-orange/90',
      interval: intervalPreviews[FsrsRating.Hard],
      keyboardShortcut: '2 or down-arrow'
    },
    {
      rating: FsrsRating.Good,
      label: 'Good',
      color: 'bg-accent',
      hoverColor: 'hover:bg-accent/90',
      textColor: 'text-accent-foreground',
      interval: intervalPreviews[FsrsRating.Good],
      keyboardShortcut: '3 or right-arrow'
    },
    {
      rating: FsrsRating.Easy,
      label: 'Easy',
      color: 'bg-brand-green',
      hoverColor: 'hover:bg-brand-green/90',
      interval: intervalPreviews[FsrsRating.Easy],
      keyboardShortcut: '4 or up-arrow'
    }
  ]

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          How well did you remember this card?
        </h3>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-2">
        {ratingOptions.map((option, index) => {
          const isLastUsed = lastRating === option.rating

          return (
            <motion.button
              key={option.rating}
              onClick={() => !isDisabled && onRate(option.rating)}
              disabled={isDisabled}
              variants={buttonVariants}
              initial="idle"
              animate={isDisabled ? 'disabled' : 'idle'}
              whileHover={isDisabled ? 'disabled' : 'hover'}
              whileTap={isDisabled ? 'disabled' : 'tap'}
              transition={springTransition}
              className={`
                h-auto min-h-[64px] sm:min-h-[80px] p-3 sm:p-3
                flex flex-col items-center gap-1 sm:gap-1
                text-white font-medium rounded-md
                ${option.color} ${option.hoverColor}
                ${option.textColor || ''}
                ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}
                ${isLastUsed ? 'ring-2 ring-offset-2 ring-white' : ''}
                focus:outline-none focus-visible:ring-2
                focus-visible:ring-offset-2 focus-visible:ring-white
              `}
              style={{
                // Staggered entrance
                animationDelay: `${index * 50}ms`
              }}
            >
              <span className="text-[9px] sm:text-xs opacity-80
                               leading-tight font-normal">
                {option.keyboardShortcut}
              </span>
              <span className="text-xs sm:text-base leading-tight font-semibold">
                {option.label}
              </span>
              <span className="text-[8px] sm:text-xs opacity-75
                               font-normal leading-tight">
                {option.interval}
              </span>
            </motion.button>
          )
        })}
      </div>

      <div className="mt-4 text-center">
        <p className="text-xs text-muted-foreground">
          Choose the option that best describes your recall experience
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Keyboard: left/down/right/up or 1-4 | Space or tap to flip
        </p>
      </div>
    </div>
  )
}
```

#### Create Animated Button Wrapper

Create `src/components/ui/animatedButton.tsx`:

```typescript
"use client"

import * as React from "react"
import { motion, HTMLMotionProps } from 'framer-motion'
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  `inline-flex items-center justify-center gap-2 whitespace-nowrap
   rounded-md text-sm font-medium transition-colors
   disabled:pointer-events-none disabled:opacity-50
   outline-none focus-visible:ring-2 focus-visible:ring-ring`,
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-foreground hover:bg-accent/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3",
        lg: "h-10 rounded-md px-6",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const motionVariants = {
  idle: { scale: 1 },
  hover: { scale: 1.02 },
  tap: { scale: 0.98 }
}

const springConfig = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 17
}

type AnimatedButtonProps = HTMLMotionProps<"button"> &
  VariantProps<typeof buttonVariants>

/**
 * Button component with spring physics animations.
 * Input: standard button props + variant/size
 * Output: Animated button with hover/tap feedback
 */
export function AnimatedButton({
  className,
  variant,
  size,
  disabled,
  children,
  ...props
}: AnimatedButtonProps) {
  return (
    <motion.button
      variants={motionVariants}
      initial="idle"
      whileHover={disabled ? 'idle' : 'hover'}
      whileTap={disabled ? 'idle' : 'tap'}
      transition={springConfig}
      disabled={disabled}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {children}
    </motion.button>
  )
}
```

---

### Solution 4: Page Transitions with AnimatePresence

**Priority:** LOW
**Effort:** 1.5 hours

Add smooth transitions between routes using Framer Motion's AnimatePresence.

#### Create Page Transition Wrapper

Create `src/components/layout/pageTransition.tsx`:

```typescript
"use client"

import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'

interface PageTransitionProps {
  children: React.ReactNode
}

const pageVariants = {
  initial: {
    opacity: 0,
    y: 8
  },
  enter: {
    opacity: 1,
    y: 0
  },
  exit: {
    opacity: 0,
    y: -8
  }
}

const pageTransition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.2
}

/**
 * Wraps page content with enter/exit animations.
 * Input: page children
 * Output: Animated page wrapper
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial="initial"
        animate="enter"
        exit="exit"
        variants={pageVariants}
        transition={pageTransition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

#### Update Layout to Use Page Transitions

In your layout file (e.g., `src/app/(main)/layout.tsx`):

```typescript
import { PageTransition } from '@/components/layout/pageTransition'

export default function MainLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <PageTransition>
          {children}
        </PageTransition>
      </main>
      <Footer />
    </div>
  )
}
```

**Note:** Page transitions in Next.js App Router require careful handling.
For production, consider using `next-view-transitions` package which
leverages the View Transitions API for better performance.

---

## Implementation Steps

### Phase 1: High Impact, Low Effort (Day 1)

| Priority | Task | Time | Impact |
|----------|------|------|--------|
| 1 | Add spring physics to rating buttons | 30 min | HIGH |
| 2 | Create session completion celebration | 1 hr | HIGH |
| 3 | Add confetti to session complete | 30 min | MEDIUM |

### Phase 2: Core Experience (Day 2)

| Priority | Task | Time | Impact |
|----------|------|------|--------|
| 4 | Implement 3D card flip | 2 hr | HIGH |
| 5 | Update useFlipCard hook for 3D | 30 min | HIGH |
| 6 | Add GPU acceleration CSS | 15 min | MEDIUM |

### Phase 3: Polish (Day 3)

| Priority | Task | Time | Impact |
|----------|------|------|--------|
| 7 | Create AnimatedButton component | 30 min | LOW |
| 8 | Add page transitions | 1 hr | LOW |
| 9 | Performance testing | 30 min | MEDIUM |

---

## Performance Considerations

### GPU Acceleration

All animations should use GPU-accelerated properties:

```css
/* Good - GPU accelerated */
transform: translateX(10px);
transform: scale(1.05);
transform: rotateY(180deg);
opacity: 0.5;

/* Bad - triggers layout/paint */
left: 10px;
width: 105%;
margin: 10px;
```

### Will-Change Hints

Use sparingly for complex animations:

```css
.flip-card {
  will-change: transform;
}

/* Remove after animation completes */
.flip-card.complete {
  will-change: auto;
}
```

### Animation Frame Budget

Target 60fps = 16.67ms per frame:

```typescript
// Good - uses requestAnimationFrame
const animate = () => {
  // Update logic
  requestAnimationFrame(animate)
}

// Better - check frame time
let lastTime = 0
const animate = (time: number) => {
  const delta = time - lastTime
  if (delta < 16) {
    requestAnimationFrame(animate)
    return
  }
  lastTime = time
  // Update logic
  requestAnimationFrame(animate)
}
```

### Reduce Motion Support

Always respect user preferences:

```typescript
// In component
const prefersReducedMotion = useReducedMotion()

<motion.div
  animate={prefersReducedMotion ? {} : { scale: 1.05 }}
>
```

```typescript
// Hook implementation
import { useEffect, useState } from 'react'

export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return prefersReducedMotion
}
```

---

## Testing Approach

### Visual Regression Testing

Use Playwright or Cypress for animation testing:

```typescript
test('flashcard flip animation completes', async ({ page }) => {
  await page.goto('/study/series-1/chapter-1')

  // Click to flip
  await page.click('[data-testid="flashcard"]')

  // Wait for animation
  await page.waitForTimeout(600) // FLIP_DURATION

  // Verify back face is visible
  await expect(page.locator('[data-testid="definition"]')).toBeVisible()
})

test('confetti fires on session complete', async ({ page }) => {
  // Complete all cards...

  // Check canvas exists
  await expect(page.locator('canvas.confetti')).toBeVisible()
})
```

### Performance Profiling

```typescript
// Add performance marks
performance.mark('flip-start')
// ... flip animation
performance.mark('flip-end')
performance.measure('flip-duration', 'flip-start', 'flip-end')

const measure = performance.getEntriesByName('flip-duration')[0]
console.log(`Flip took ${measure.duration}ms`)
```

---

## Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Card flip duration | < 600ms | Performance API |
| Button press feedback | < 50ms perceived | User testing |
| Confetti frame rate | 60fps | Chrome DevTools |
| Animation jank | 0 dropped frames | Chrome DevTools |
| Reduced motion support | 100% coverage | a11y audit |
| User satisfaction | > 4.0/5.0 | User survey |

### Qualitative Goals

- Users describe study sessions as "smooth" or "satisfying"
- Card flip feels like a real flashcard
- Session completion feels like an achievement
- Buttons feel responsive on mobile
- Navigation feels connected, not jarring

---

## References

- [Framer Motion Documentation](https://www.framer.com/motion/)
- [CSS 3D Transforms](https://developer.mozilla.org/en-US/docs/Web/CSS/transform-style)
- [canvas-confetti](https://github.com/catdad/canvas-confetti)
- [Duolingo UX Analysis](https://growth.design/case-studies/duolingo-user-engagement)
- [The Role of Animation in UX](https://www.nngroup.com/articles/animation-usability/)
- [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
