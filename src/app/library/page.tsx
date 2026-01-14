import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserLibraryDecks } from '@/lib/series/libraryData'
import { LibraryControls } from '@/components/library/libraryControls'
import { EmptyState } from '@/components/ui/empty-state'

export default async function LibraryPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const decks = await getUserLibraryDecks(user.id)

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">

        {decks.length === 0 ? (
          <EmptyState
            variant="library"
            title="Your library is empty"
            description="Start studying chapters to build your vocabulary library"
            action={{ label: 'Browse Series', href: '/browse' }}
          />
        ) : (
          <LibraryControls decks={decks} />
        )}
      </div>
    </div>
  )
}
