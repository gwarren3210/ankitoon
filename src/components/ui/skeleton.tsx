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

/**
 * Skeleton for series cards in browse grid.
 * Matches the structure of SeriesCard component.
 * Input: none
 * Output: Series card-shaped skeleton
 */
export function SeriesCardSkeleton() {
  return (
    <div className="h-full rounded-xl border bg-card text-card-foreground
                    flex flex-col shadow-sm p-0 overflow-hidden">
      {/* Cover image placeholder - matches aspect-[3/4] */}
      <Skeleton className="w-full aspect-[3/4] rounded-none" />

      {/* Series Info - matches p-4 space-y-2 */}
      <div className="p-4 space-y-2">
        {/* Title block */}
        <div>
          {/* Series name - h3 font-semibold text-lg */}
          <Skeleton className="h-7 w-3/4" />
          {/* Korean name - text-sm */}
          <Skeleton className="h-5 w-1/2 mt-1" />
        </div>

        {/* Stats - flex flex-wrap gap-3 text-sm */}
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
    </div>
  )
}

/**
 * Grid of series skeleton cards for loading states.
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

/**
 * Skeleton for deck cards in library grid.
 * Matches the structure of DeckCard component.
 * Input: none
 * Output: Deck card-shaped skeleton
 */
export function DeckCardSkeleton() {
  return (
    <div className="h-full rounded-xl border bg-card text-card-foreground
                    flex flex-col gap-6 py-6 shadow-sm">
      {/* CardContent - px-4 sm:px-6 */}
      <div className="px-4 sm:px-6">
        <div className="flex flex-col h-full space-y-3">
          {/* Series name - text-sm font-medium */}
          <Skeleton className="h-5 w-2/5" />

          {/* Chapter Info - font-semibold text-lg */}
          <Skeleton className="h-7 w-1/3" />

          {/* Progress Info - space-y-2 */}
          <div className="space-y-2">
            {/* Cards studied row - flex justify-between text-sm */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-16" />
            </div>

            {/* Due cards - text-xs */}
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>

            {/* Progress bar - h-2 */}
            <Skeleton className="h-2 w-full rounded-full" />

            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>

          {/* Last studied - pt-2 border-t text-xs */}
          <div className="pt-2 border-t">
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Grid of deck skeleton cards for library loading states.
 * Input: count - number of skeleton cards to show
 * Output: Grid of deck skeleton cards
 */
export function DeckGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <DeckCardSkeleton key={i} />
      ))}
    </div>
  )
}

interface TableSkeletonProps {
  rows?: number
  columns?: number
  showHeader?: boolean
}

/**
 * Skeleton for table loading states.
 * Input: rows count, columns count, whether to show header
 * Output: Table-shaped skeleton
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
                  {/* Extra line for first column (Korean term with example) */}
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
 * Skeleton for study session loading state.
 * Shows progress bar, flashcard, and rating buttons skeleton.
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
      <div className="rounded-xl border bg-card py-6">
        <div className="px-6 sm:px-8 min-h-[300px] sm:min-h-[400px]">
          <div className="flex flex-col items-center justify-center
                          h-full space-y-6 py-12">
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
        </div>
      </div>

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

/**
 * Skeleton for chapter page header and stats.
 * Input: none
 * Output: Chapter header skeleton
 */
export function ChapterHeaderSkeleton() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Title and action */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4">
            <Skeleton className="h-4 w-16 mb-2" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Skeleton for text content with variable line widths.
 * Input: number of lines
 * Output: Text-like skeleton
 */
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
