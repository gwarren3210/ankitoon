import { Skeleton, ChapterHeaderSkeleton, TableSkeleton } from '@/components/ui/skeleton'

/**
 * Loading state for chapter detail page.
 * Shows skeleton for header, stats, and vocabulary table.
 * Input: none
 * Output: Chapter detail loading skeleton
 */
export default function ChapterDetailLoading() {
  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8">
        <ChapterHeaderSkeleton />

        {/* Vocabulary Table Card */}
        <div className="rounded-xl border bg-card">
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
    </div>
  )
}
