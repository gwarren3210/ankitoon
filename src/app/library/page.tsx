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
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-8 text-4xl font-bold text-zinc-950 
                       dark:text-zinc-50">
          Library
        </h1>

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

