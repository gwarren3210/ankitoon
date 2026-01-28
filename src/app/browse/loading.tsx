import { Skeleton, SeriesGridSkeleton } from '@/components/ui/skeleton'

/**
 * Loading state for browse page.
 * Shows skeleton grid while series data is being fetched.
 * Input: none
 * Output: Browse page loading skeleton
 */
export default function BrowseLoading() {
  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8">
        {/* Page title */}
        <Skeleton className="h-9 sm:h-10 w-48" />

        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Skeleton className="h-10 flex-1 max-w-md" />
          <Skeleton className="h-10 w-full sm:w-32" />
        </div>

        {/* Series grid */}
        <SeriesGridSkeleton count={8} />
      </div>
    </div>
  )
}
