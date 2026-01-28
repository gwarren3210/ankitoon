import { Skeleton, DeckGridSkeleton } from '@/components/ui/skeleton'

/**
 * Loading state for library page.
 * Shows skeleton grid while deck data is being fetched.
 * Input: none
 * Output: Library page loading skeleton
 */
export default function LibraryLoading() {
  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8">
        {/* Page title */}
        <Skeleton className="h-9 sm:h-10 w-40" />

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Skeleton className="h-10 w-full sm:w-32" />
          <Skeleton className="h-10 w-full sm:w-32" />
        </div>

        {/* Deck grid */}
        <DeckGridSkeleton count={6} />
      </div>
    </div>
  )
}
