import { createClient } from '@/lib/supabase/server'
import { getUserLibraryDecks } from '@/lib/series/libraryData'
import { getChapterCardCountsBatch } from '@/lib/progress/queries/chapterProgressQueries'
import { LibraryControls } from '@/components/library/libraryControls'
import { EmptyState } from '@/components/ui/empty-state'

export default async function LibraryPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Show placeholder when not authenticated - modal will overlay
  if (!user) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="mx-auto max-w-7xl">
          <EmptyState
            variant="library"
            title="Sign in to view your library"
            description="Your vocabulary decks will appear here after signing in"
            action={{ label: 'Browse Series', href: '/browse' }}
          />
        </div>
      </div>
    )
  }

  const decks = await getUserLibraryDecks(user.id)

  // Fetch new card counts for all chapters in one batch query
  const chapterIds = decks.map(deck => deck.chapter.id)
  const cardCountsMap = await getChapterCardCountsBatch(user.id, chapterIds)

  // Merge newCount into decks
  const decksWithCounts = decks.map(deck => ({
    ...deck,
    newCount: cardCountsMap.get(deck.chapter.id)?.newCount ?? 0
  }))

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">

        {decksWithCounts.length === 0 ? (
          <EmptyState
            variant="library"
            title="Your library is empty"
            description="Start studying chapters to build your vocabulary library"
            action={{ label: 'Browse Series', href: '/browse' }}
          />
        ) : (
          <LibraryControls decks={decksWithCounts} />
        )}
      </div>
    </div>
  )
}
