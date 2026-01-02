import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUserLibraryDecks } from '@/lib/series/libraryData'
import { LibraryControls } from '@/components/library/libraryControls'

export default async function LibraryPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  const decks = await getUserLibraryDecks(supabase, user.id)

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">

        {decks.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              You haven&apos;t started studying any chapters yet.
            </p>
            <Link
              href="/browse"
              className="text-primary hover:underline font-medium"
            >
              Browse Series
            </Link>
          </div>
        ) : (
          <LibraryControls decks={decks} />
        )}
      </div>
    </div>
  )
}

