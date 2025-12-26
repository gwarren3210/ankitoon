import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSeriesBySlug } from '@/lib/series/seriesData'
import { getChapterByNumber } from '@/lib/series/chapterData'
import { StudySession } from '@/components/study/studySession'

interface StudyPageProps {
  params: Promise<{ slug: string; chapter: string }>
}

/**
 * Study page for flashcards in a specific chapter.
 * Input: series slug and chapter number from URL params
 * Output: Server-rendered study page with initial card data
 */
export default async function StudyPage({ params }: StudyPageProps) {
  const { slug, chapter: chapterParam } = await params
  const chapterNumber = parseInt(chapterParam, 10)

  if (isNaN(chapterNumber) || chapterNumber < 1) {
    notFound()
  }

  const supabase = await createClient()

  // Get authenticated user (may be anonymous)
  const { data: { user } } = await supabase.auth.getUser()
  const isAuthenticated = user ? !user.is_anonymous : false

  // Fetch series data
  const series = await getSeriesBySlug(supabase, slug)
  if (!series) {
    notFound()
  }

  // Fetch chapter data
  const chapter = await getChapterByNumber(supabase, series.id, chapterNumber)
  if (!chapter) {
    notFound()
  }


  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Guest Banner */}
        {user?.is_anonymous && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 text-amber-600 dark:text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                  You&apos;re using a guest account
                </h3>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                  Sign up to save your progress permanently and access it from any device.
                </p>
                <a
                  href="/signup"
                  className="mt-2 inline-block text-sm font-medium text-amber-900 underline hover:text-amber-700 dark:text-amber-100 dark:hover:text-amber-300"
                >
                  Create Account
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Study Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            Study: {series.name} - Chapter {chapter.chapter_number}
          </h1>
          {chapter.title && (
            <p className="text-muted-foreground mt-1">{chapter.title}</p>
          )}
        </div>

        {/* Study Session */}
        <StudySession
          seriesSlug={slug}
          seriesName={series.name}
          chapter={chapter}
          isAuthenticated={isAuthenticated}
        />

        {/* Navigation Links */}
        <div className="flex justify-center gap-4 pt-6 border-t">
          <a
            href={`/browse/${slug}/${chapterNumber}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to Chapter
          </a>
          <a
            href={`/browse/${slug}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View All Chapters →
          </a>
        </div>
      </div>
    </div>
  )
}
