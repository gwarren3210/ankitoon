import { StudySessionSkeleton } from '@/components/ui/skeleton'

/**
 * Loading state for study session page.
 * Shows skeleton flashcard interface while cards are being fetched.
 * Input: none
 * Output: Study session loading skeleton
 */
export default function StudyLoading() {
  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-2xl">
        {/* Header skeleton */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-muted animate-shimmer
                              bg-gradient-to-r from-muted via-muted/50 to-muted
                              bg-[length:200%_100%]" />
              <div className="h-6 w-32 rounded-md bg-muted animate-shimmer
                              bg-gradient-to-r from-muted via-muted/50 to-muted
                              bg-[length:200%_100%]" />
            </div>
          </div>
        </div>

        {/* Study session skeleton */}
        <StudySessionSkeleton />
      </div>
    </div>
  )
}
