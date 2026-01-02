import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getChapterPageData } from '@/lib/series/chapterData'
import { ChapterNav } from '@/components/chapter/chapterNav'
import { ChapterHeader } from '@/components/chapter/chapterHeader'
import { VocabularyList } from '@/components/chapter/vocabularyList'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DbClient } from '@/lib/study/types'

interface ChapterPageProps {
  params: Promise<{ slug: string; chapter: string }>
}

/**
 * Chapter detail page showing vocabulary and navigation.
 * Input: series slug and chapter number from URL params
 * Output: Server-rendered chapter page
 */
export default async function ChapterPage({ params }: ChapterPageProps) {
  const { slug, chapter: chapterParam } = await params
  const chapterNumber = parseInt(chapterParam, 10)

  if (isNaN(chapterNumber) || chapterNumber < 1) {
    notFound()
  }

  const supabase: DbClient = await createClient()

  // Get authenticated user (may be anonymous)
  const { data: { user } } = await supabase.auth.getUser()
  const isAuthenticated = user ? !user.is_anonymous : false

  // Single optimized query for all chapter page data
  const {
    series,
    chapter,
    prevChapter,
    nextChapter,
    vocabulary,
    chapterProgress
  } = await getChapterPageData(
    supabase,
    slug,
    chapterNumber,
    isAuthenticated && user ? user.id : undefined
  )

  if (!series || !chapter) {
    // TODO: handle this more gracefully
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

        {/* Chapter Navigation */}
        <ChapterNav
          seriesSlug={slug}
          seriesName={series.name}
          currentChapter={chapter}
          prevChapter={prevChapter}
          nextChapter={nextChapter}
        />

        {/* Chapter Header */}
        <ChapterHeader
          seriesName={series.name}
          chapterNumber={chapter.chapter_number}
          chapterTitle={chapter.title}
          seriesSlug={slug}
        />

        {/* Progress Summary (for authenticated users) */}
        {isAuthenticated && chapterProgress && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Cards Studied:</span>
                  <div className="font-medium">{chapterProgress.num_cards_studied}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Unique Vocab Seen:</span>
                  <div className="font-medium">{chapterProgress.unique_vocab_seen}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Accuracy:</span>
                  <div className="font-medium">
                    {chapterProgress.accuracy ? Math.round(chapterProgress.accuracy * 100) : 0}%
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div className="font-medium">
                    {chapterProgress.completed ? 'Completed' : 'In Progress'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vocabulary List */}
        <VocabularyList vocabulary={vocabulary} />
      </div>
    </div>
  )
}
