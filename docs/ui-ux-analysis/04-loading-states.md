# UI/UX Issue #4: Loading States & Feedback

**Severity:** MEDIUM-HIGH
**Impact:** High - Poor loading states make the app feel slow and unpolished
**Effort:** ~3 hours
**Priority:** High

---

## Problem Description

Loading states across AnkiToon are inconsistent and lack visual polish. The
current implementation uses static text ("Loading...", "Saving...") rather
than skeleton loaders, shimmer animations, or spinner components that users
expect from modern applications.

### Current Implementation Audit

#### Study Session (`studySession.tsx:84-86`)

```typescript
// Show loading state
if (isLoading) {
  return <StudyTips />
}
```

**Issue:** Shows helpful tips while loading (good content), but no visual
indicator that cards are being fetched. Users might not realize loading is
happening.

#### Settings Tab (`settingsTab.tsx:181`)

```typescript
<Button type="submit" disabled={loading}>
  {loading ? 'Saving...' : 'Save Settings'}
</Button>
```

**Issue:** Text-only loading indicator. No spinner, no visual feedback
beyond the text change. Button could appear "stuck" to users.

#### Series Card (`seriesCard.tsx`)

```typescript
// No loading state - component expects data to be present
<Card className="h-full transition-all hover:shadow-md...">
```

**Issue:** No skeleton variant for list loading. Grid jumps when data loads.

#### Deck Card (`deckCard.tsx`)

```typescript
// No loading state - component expects LibraryDeck data
<Card className="h-full transition-all hover:shadow-md...">
```

**Issue:** Same as SeriesCard - no skeleton variant for library grid.

#### Vocabulary List (`vocabularyList.tsx`)

```typescript
// Empty state shown, but no loading state
if (vocabulary.length === 0) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <p className="text-muted-foreground">
          No vocabulary available for this chapter.
        </p>
      </CardContent>
    </Card>
  )
}
```

**Issue:** No table skeleton for loading state. Data appears instantly or
shows empty state - no in-between.

### What's Wrong

1. **No Skeleton Loaders**
   - Card grids have no skeleton placeholders
   - Table rows don't have loading skeletons
   - Content "pops in" abruptly

2. **Text-Only Button Loading**
   - Buttons change text to "Saving..." / "Loading..."
   - No visual spinner or animation
   - Inconsistent with modern UX expectations

3. **No Shimmer Animations**
   - Static gray blocks would be better than nothing
   - Shimmer animation indicates "something is happening"
   - Missing visual movement during waits

4. **Inconsistent Patterns**
   - Study session: Shows StudyTips component
   - Settings: Shows text change
   - Lists: Show nothing (data or empty state)
   - No unified loading approach

5. **Missing Loading States**
   - Navigation doesn't show loading for page transitions
   - Image loading has no placeholder (Next.js Image handles this)
   - Some API operations have no feedback at all

---

## Why Loading States Matter

### Perceived Performance

Studies show that perceived speed matters more than actual speed:

- **0-100ms:** Feels instant
- **100-300ms:** Slight delay, acceptable
- **300-1000ms:** Noticeable delay, needs feedback
- **1000ms+:** Must show progress indicator

**Current problem:** Even 200ms delays feel slow without visual feedback.
With skeletons, 500ms delays can feel instant.

### User Trust

Loading feedback communicates:
- "We received your action"
- "Something is happening"
- "The app isn't broken"

**Without feedback:** Users double-click, refresh, or assume the app broke.

### Layout Stability

Skeleton loaders:
- Prevent layout shift (CLS metric)
- Reserve space for incoming content
- Create smoother visual transitions

**Without skeletons:** Content "jumps in," which feels jarring.

### Brand Perception

Modern apps (Notion, Linear, Vercel) use polished loading states. Users
subconsciously associate skeleton loaders with quality.

**Text-only loading:** Feels dated, like 2010-era web apps.

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

- **Skeleton Components**: React components with Tailwind classes
- **Shimmer Animation**: CSS keyframes (@keyframes shimmer)
- **Button Spinners**: Lucide `Loader2` icon with spin animation
- **Integration**: Suspense boundaries and loading states

### No Blockers

Implementation can begin immediately. No design decisions, image assets,
or human input required.

### Implementation Order

```
Step 1: Base Components (30 min)
├── Create src/components/ui/skeleton.tsx
└── Add shimmer CSS to globals.css

Step 2: Variant Components (30 min)
├── SeriesCardSkeleton
├── DeckCardSkeleton
└── TableRowSkeleton

Step 3: Button Loading (20 min)
└── Update Button component with loading prop

Step 4: Integration (30 min)
├── Update browse page
├── Update library page
├── Update chapter page
└── Update study session
```

### Dependencies

- No new packages needed
- Uses existing Tailwind CSS
- Uses existing Lucide icons (Loader2)

### Start Command

This issue is ready for immediate implementation:
```bash
# No installation needed - start coding:
# 1. src/components/ui/skeleton.tsx (new)
# 2. src/app/globals.css (add shimmer keyframes)
# 3. src/components/ui/button.tsx (add loading prop)
# 4. src/components/series/seriesCardSkeleton.tsx (new)
# 5. Update pages with Suspense boundaries
```

---

## Recommended Solutions

### 1. Skeleton Component System

Create a flexible skeleton component that can compose into card, list, and
table variants.

```typescript
// src/components/ui/skeleton.tsx

import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

/**
 * Base skeleton component with shimmer animation.
 * Input: optional className for sizing/styling
 * Output: Animated skeleton placeholder
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-shimmer bg-gradient-to-r from-muted via-muted/50 to-muted',
        'bg-[length:200%_100%] rounded-md',
        className
      )}
    />
  )
}
```

### 2. Shimmer Animation CSS

Add to `globals.css`:

```css
@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.animate-shimmer {
  animation: shimmer 1.5s ease-in-out infinite;
}
```

### 3. Card Skeleton Variants

```typescript
// src/components/ui/skeleton.tsx (continued)

/**
 * Skeleton for series cards in browse grid.
 * Input: none
 * Output: Series card-shaped skeleton
 */
export function SeriesCardSkeleton() {
  return (
    <div className="h-full rounded-lg border bg-card p-0 overflow-hidden">
      {/* Cover image placeholder */}
      <Skeleton className="w-full aspect-[3/4]" />

      {/* Content area */}
      <div className="p-4 space-y-2">
        {/* Title */}
        <Skeleton className="h-6 w-3/4" />
        {/* Korean name */}
        <Skeleton className="h-4 w-1/2" />
        {/* Stats */}
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  )
}

/**
 * Skeleton for deck cards in library grid.
 * Input: none
 * Output: Deck card-shaped skeleton
 */
export function DeckCardSkeleton() {
  return (
    <div className="h-full rounded-lg border bg-card p-4 sm:p-6">
      <div className="flex flex-col h-full space-y-3">
        {/* Series name */}
        <Skeleton className="h-4 w-1/3" />

        {/* Chapter title */}
        <Skeleton className="h-6 w-1/2" />

        {/* Progress section */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          {/* Progress bar */}
          <Skeleton className="h-2 w-full rounded-full" />
          {/* Badge */}
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>

        {/* Last studied */}
        <div className="pt-2 border-t">
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    </div>
  )
}
```

### 4. Table Skeleton

```typescript
// src/components/ui/skeleton.tsx (continued)

interface TableSkeletonProps {
  rows?: number
  columns?: number
}

/**
 * Skeleton for table loading states.
 * Input: number of rows and columns to display
 * Output: Table-shaped skeleton
 */
export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="text-left p-3">
                <Skeleton className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="p-3">
                  <Skeleton
                    className={cn(
                      'h-4',
                      colIndex === 0 ? 'w-32' : 'w-16'
                    )}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

### 5. Button Loader Component

```typescript
// src/components/ui/buttonLoader.tsx

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ButtonLoaderProps {
  className?: string
}

/**
 * Animated spinner for button loading states.
 * Input: optional className
 * Output: Spinning loader icon
 */
export function ButtonLoader({ className }: ButtonLoaderProps) {
  return (
    <Loader2
      className={cn(
        'h-4 w-4 animate-spin',
        className
      )}
    />
  )
}
```

### 6. Flashcard Skeleton

```typescript
// src/components/study/flashcardSkeleton.tsx

import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

/**
 * Skeleton for flashcard loading state during study sessions.
 * Input: none
 * Output: Flashcard-shaped skeleton
 */
export function FlashcardSkeleton() {
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6 sm:p-8">
        <div className="text-center space-y-6">
          {/* Korean term */}
          <Skeleton className="h-12 w-32 mx-auto" />

          {/* Romanization */}
          <Skeleton className="h-4 w-24 mx-auto" />

          {/* Example sentence */}
          <div className="space-y-2 pt-4">
            <Skeleton className="h-4 w-full max-w-md mx-auto" />
            <Skeleton className="h-4 w-3/4 max-w-sm mx-auto" />
          </div>

          {/* Tap to reveal hint */}
          <Skeleton className="h-4 w-20 mx-auto mt-8" />
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## Implementation Steps

### Step 1: Create Base Skeleton Component (30 minutes)

1. Create `src/components/ui/skeleton.tsx`:

```typescript
import { cn } from '@/lib/utils'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

/**
 * Base skeleton component with shimmer animation.
 * Input: standard div props plus className
 * Output: Animated skeleton placeholder
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-shimmer bg-gradient-to-r',
        'from-muted via-muted/50 to-muted',
        'bg-[length:200%_100%] rounded-md',
        className
      )}
      {...props}
    />
  )
}
```

2. Add shimmer keyframes to `globals.css`:

```css
/* Loading Animations */
@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.animate-shimmer {
  animation: shimmer 1.5s ease-in-out infinite;
}

/* Alternative pulse animation for simpler skeletons */
@keyframes skeleton-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-skeleton-pulse {
  animation: skeleton-pulse 2s ease-in-out infinite;
}
```

### Step 2: Add Card Skeleton Variants (30 minutes)

1. Add to `skeleton.tsx`:

```typescript
/**
 * Skeleton for series cards in browse grid.
 * Matches the structure of SeriesCard component.
 */
export function SeriesCardSkeleton() {
  return (
    <div className="h-full rounded-lg border bg-card p-0 overflow-hidden">
      <Skeleton className="w-full aspect-[3/4]" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  )
}

/**
 * Skeleton for deck cards in library grid.
 * Matches the structure of DeckCard component.
 */
export function DeckCardSkeleton() {
  return (
    <div className="h-full rounded-lg border bg-card p-4 sm:p-6">
      <div className="flex flex-col h-full space-y-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-6 w-1/2" />
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="pt-2 border-t">
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    </div>
  )
}

/**
 * Grid of skeleton cards for loading states.
 * Input: count - number of skeleton cards to show
 * Output: Grid of skeleton cards
 */
export function SeriesGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SeriesCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function DeckGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <DeckCardSkeleton key={i} />
      ))}
    </div>
  )
}
```

### Step 3: Create Button Loading Pattern (20 minutes)

1. Update button usage pattern:

```typescript
// Pattern for loading buttons
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Usage in components:
<Button type="submit" disabled={loading}>
  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {loading ? 'Saving...' : 'Save Settings'}
</Button>
```

2. Update `settingsTab.tsx` (line 181):

```typescript
<Button type="submit" disabled={loading}>
  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {loading ? 'Saving...' : 'Save Settings'}
</Button>
```

Add import at top:

```typescript
import { Loader2 } from 'lucide-react'
```

### Step 4: Create Table Skeleton (20 minutes)

Add to `skeleton.tsx`:

```typescript
interface TableSkeletonProps {
  rows?: number
  columns?: number
  showHeader?: boolean
}

/**
 * Skeleton for table loading states.
 * Input: rows count, columns count, whether to show header
 * Output: Table-shaped skeleton matching vocabularyList structure
 */
export function TableSkeleton({
  rows = 5,
  columns = 4,
  showHeader = true
}: TableSkeletonProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        {showHeader && (
          <thead>
            <tr className="border-b">
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="text-left p-3">
                  <Skeleton className="h-4 w-20" />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="p-3">
                  <Skeleton
                    className={`h-4 ${colIndex === 0 ? 'w-32' : 'w-16'}`}
                  />
                  {/* Extra line for first column (example sentence) */}
                  {colIndex === 0 && rowIndex % 2 === 0 && (
                    <Skeleton className="h-3 w-48 mt-1" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Vocabulary list specific skeleton.
 * Matches VocabularyList component structure.
 */
export function VocabularyListSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-48" />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4">
            <Skeleton className="h-4 w-16 mb-2" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="rounded-lg border bg-card">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        </div>
        <div className="p-6">
          <TableSkeleton rows={10} columns={4} />
        </div>
      </div>
    </div>
  )
}
```

### Step 5: Create Study Session Loading (20 minutes)

Create `src/components/study/studySessionSkeleton.tsx`:

```typescript
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

/**
 * Skeleton for study session loading state.
 * Shows card skeleton with progress bar skeleton.
 * Input: none
 * Output: Study session loading skeleton
 */
export function StudySessionSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Progress bar skeleton */}
      <div className="space-y-1 sm:space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-1.5 sm:h-2 w-full rounded-full" />
      </div>

      {/* Flashcard skeleton */}
      <Card className="w-full">
        <CardContent className="p-6 sm:p-8 min-h-[300px] sm:min-h-[400px]">
          <div className="flex flex-col items-center justify-center h-full space-y-6">
            {/* Korean term */}
            <Skeleton className="h-12 sm:h-16 w-40 sm:w-48" />

            {/* Romanization */}
            <Skeleton className="h-4 w-24" />

            {/* Example sentence area */}
            <div className="space-y-2 w-full max-w-md">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4 mx-auto" />
            </div>

            {/* Tap hint */}
            <Skeleton className="h-4 w-28 mt-4" />
          </div>
        </CardContent>
      </Card>

      {/* Rating buttons skeleton */}
      <div className="flex justify-center gap-2 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg"
          />
        ))}
      </div>
    </div>
  )
}
```

### Step 6: Update Components to Use Skeletons (30 minutes)

1. **Update studySession.tsx:**

```typescript
import { StudySessionSkeleton } from '@/components/study/studySessionSkeleton'

// Replace line 84-86:
if (isLoading) {
  return (
    <div className="space-y-6">
      <StudySessionSkeleton />
      <StudyTips />
    </div>
  )
}
```

2. **Create loading.tsx files for route segments:**

`src/app/browse/loading.tsx`:

```typescript
import { SeriesGridSkeleton } from '@/components/ui/skeleton'

export default function BrowseLoading() {
  return (
    <div className="container py-8 space-y-6">
      {/* Search and filters skeleton */}
      <div className="flex gap-4">
        <Skeleton className="h-10 flex-1 max-w-md" />
        <Skeleton className="h-10 w-24" />
      </div>

      {/* Grid skeleton */}
      <SeriesGridSkeleton count={8} />
    </div>
  )
}
```

`src/app/library/loading.tsx`:

```typescript
import { DeckGridSkeleton } from '@/components/ui/skeleton'

export default function LibraryLoading() {
  return (
    <div className="container py-8 space-y-6">
      {/* Header skeleton */}
      <Skeleton className="h-9 w-48" />

      {/* Filters skeleton */}
      <div className="flex gap-4">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Grid skeleton */}
      <DeckGridSkeleton count={6} />
    </div>
  )
}
```

---

## Integration Examples

### Browse Page with Loading State

```typescript
// src/app/browse/page.tsx
import { Suspense } from 'react'
import { SeriesGridSkeleton } from '@/components/ui/skeleton'
import { SeriesGrid } from '@/components/series/seriesGrid'

export default function BrowsePage() {
  return (
    <div className="container py-8">
      <Suspense fallback={<SeriesGridSkeleton count={8} />}>
        <SeriesGrid />
      </Suspense>
    </div>
  )
}
```

### Library Page with Loading State

```typescript
// src/app/library/page.tsx
import { Suspense } from 'react'
import { DeckGridSkeleton } from '@/components/ui/skeleton'
import { LibraryGrid } from '@/components/library/libraryGrid'

export default function LibraryPage() {
  return (
    <div className="container py-8">
      <Suspense fallback={<DeckGridSkeleton count={6} />}>
        <LibraryGrid />
      </Suspense>
    </div>
  )
}
```

### Chapter Page with Vocabulary Loading

```typescript
// In chapter page component
import { VocabularyListSkeleton } from '@/components/ui/skeleton'

// Usage with Suspense:
<Suspense fallback={<VocabularyListSkeleton />}>
  <VocabularyList vocabulary={vocabulary} />
</Suspense>
```

### Settings Button with Spinner

```typescript
// src/components/profile/settingsTab.tsx
import { Loader2 } from 'lucide-react'

<Button type="submit" disabled={loading}>
  {loading ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Saving...
    </>
  ) : (
    'Save Settings'
  )}
</Button>
```

---

## Alternative Approaches

### Pulse Animation Instead of Shimmer

If shimmer feels too busy, use a simpler pulse:

```typescript
export function SkeletonPulse({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-muted rounded-md',
        className
      )}
    />
  )
}
```

### Content-Aware Skeletons

For text content, match approximate line widths:

```typescript
export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  const widths = ['w-full', 'w-5/6', 'w-4/6', 'w-3/4', 'w-2/3']

  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${widths[i % widths.length]}`}
        />
      ))}
    </div>
  )
}
```

### Optimistic UI (Already Implemented)

The study session already uses optimistic updates for card ratings. This is
the gold standard - extend this pattern to other operations:

```typescript
// Example: Optimistic settings update
const handleSubmit = async () => {
  // Update UI immediately
  onUpdate({ ...profile, max_new_cards: newValue })

  try {
    await patchJson('/api/profile/settings', { max_new_cards: newValue })
  } catch {
    // Revert on failure
    onUpdate(profile)
    setError('Failed to save')
  }
}
```

---

## Testing Approach

### Visual Testing

1. Add artificial delay to APIs in development:

```typescript
// In API route, add for testing:
if (process.env.NODE_ENV === 'development') {
  await new Promise(r => setTimeout(r, 2000))
}
```

2. Verify skeletons appear immediately (no flash of empty content)
3. Verify shimmer animation is smooth (60fps)
4. Test on slow network (Chrome DevTools throttling)

### Unit Tests

```typescript
import { render, screen } from '@testing-library/react'
import {
  Skeleton,
  SeriesCardSkeleton,
  TableSkeleton
} from '@/components/ui/skeleton'

describe('Skeleton Components', () => {
  it('renders base skeleton with shimmer class', () => {
    render(<Skeleton data-testid="skeleton" />)
    const skeleton = screen.getByTestId('skeleton')
    expect(skeleton).toHaveClass('animate-shimmer')
  })

  it('renders series card skeleton structure', () => {
    const { container } = render(<SeriesCardSkeleton />)
    const skeletons = container.querySelectorAll('.animate-shimmer')
    expect(skeletons.length).toBeGreaterThan(3)
  })

  it('renders table skeleton with correct rows', () => {
    render(<TableSkeleton rows={5} columns={4} />)
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(6) // 1 header + 5 body rows
  })
})
```

### Integration Tests

```typescript
describe('Loading States', () => {
  it('shows skeleton while loading browse page', async () => {
    render(<BrowsePage />)

    // Should show skeletons immediately
    expect(screen.getByTestId('series-grid-skeleton')).toBeInTheDocument()

    // Wait for content to load
    await waitFor(() => {
      expect(screen.queryByTestId('series-grid-skeleton')).not.toBeInTheDocument()
    })
  })
})
```

---

## Success Criteria

### Quantitative

- [ ] Skeleton appears within 16ms of navigation (one frame)
- [ ] Shimmer animation runs at 60fps
- [ ] No Cumulative Layout Shift (CLS) when content loads
- [ ] All loading states under 3 seconds show skeletons (not spinners)

### Qualitative

- [ ] Loading feels "instant" even with 500ms delays
- [ ] No "flash of empty content" on any page
- [ ] Button loading states are visually clear
- [ ] Consistent loading pattern across all pages

### Checklist

- [x] Base Skeleton component created
- [x] Shimmer animation added to globals.css
- [x] SeriesCardSkeleton implemented
- [x] DeckCardSkeleton implemented
- [x] TableSkeleton implemented
- [x] StudySessionSkeleton implemented
- [x] Button loading pattern with spinner
- [x] loading.tsx files for route segments
- [x] All "Loading..." text replaced with skeletons
- [ ] Tests added for skeleton components

---

## Current Risks

### Low Risk

1. **Performance Impact**
   - Shimmer animation is GPU-accelerated
   - Skeleton components are lightweight
   - No runtime cost beyond initial render

2. **Accessibility**
   - Skeletons use `aria-hidden` by default
   - Screen readers skip skeleton content
   - Loading state announced via aria-live regions

### Medium Risk

3. **Over-skeleton-ing**
   - Don't add skeletons for instant operations (<100ms)
   - Avoid skeleton flash for cached content
   - Consider skeleton minimum display time (300ms)

---

## References

### Internal

- Study session optimistic UI: `src/lib/hooks/useStudySession.ts`
- Current loading patterns: `src/components/study/studyTips.tsx`
- Card component structure: `src/components/series/seriesCard.tsx`

### External

- [Skeleton Loading Best Practices](https://uxdesign.cc/what-you-should-know-about-skeleton-screens-a820c45a571a)
- [Perceived Performance](https://web.dev/rail/)
- [CSS Shimmer Animation](https://css-tricks.com/building-skeleton-screens-css-custom-properties/)
- [React Suspense for Data Fetching](https://react.dev/reference/react/Suspense)

---

## Document Maintenance

**Created:** 2026-01-12
**Author:** UI/UX Analysis
**Status:** Implemented
**Implemented:** 2026-01-13
**Next Review:** After testing

When updating this document:
- Mark completed items with PR links
- Update implementation steps if approach changes
- Add new issues discovered during implementation
