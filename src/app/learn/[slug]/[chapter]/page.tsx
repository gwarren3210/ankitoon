import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSeriesBySlug } from '@/lib/series/seriesData'
import { getChapterByNumber } from '@/lib/series/chapterData'
import { LearnSession } from '@/components/learn/learnSession'
import { logger } from '@/lib/logger'

interface LearnPageProps {
  params: Promise<{ slug: string; chapter: string }>
}

/**
 * Learn page for multiple choice quiz on new vocabulary.
 * Input: series slug and chapter number from URL params
 * Output: Server-rendered learn page with LearnSession component
 */
export default async function LearnPage({ params }: LearnPageProps) {
  const { slug, chapter: chapterParam } = await params
  const chapterNumber = parseInt(chapterParam, 10)

  if (isNaN(chapterNumber) || chapterNumber < 1) {
    logger.warn({ slug, chapterParam }, 'Invalid chapter number in learn page')
    notFound()
  }

  const supabase = await createClient()

  // Get authenticated user
  const {
    data: { user }
  } = await supabase.auth.getUser()

  logger.info(
    {
      slug,
      chapterNumber,
      userId: user?.id,
      isAnonymous: user?.is_anonymous ?? false
    },
    'Learn page accessed'
  )

  // Fetch series data
  const series = await getSeriesBySlug(slug)
  if (!series) {
    logger.warn(
      { slug, chapterNumber, userId: user?.id },
      'Series not found in learn page'
    )
    notFound()
  }

  // Fetch chapter data
  const chapter = await getChapterByNumber(series.id, chapterNumber)
  if (!chapter) {
    logger.warn(
      {
        slug,
        chapterNumber,
        seriesId: series.id,
        userId: user?.id
      },
      'Chapter not found in learn page'
    )
    notFound()
  }

  logger.info(
    {
      slug,
      chapterNumber,
      seriesId: series.id,
      chapterId: chapter.id,
      userId: user?.id
    },
    'Learn page loaded successfully'
  )

  return (
    <div
      className="h-full overflow-hidden bg-background flex flex-col"
      style={{ overscrollBehavior: 'none' }}
    >
      <div
        className="flex-1 overflow-y-auto p-4 sm:p-8"
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
          {/* Guest Banner */}
          {user?.is_anonymous && (
            <div
              className="rounded-lg border border-amber-200 bg-amber-50 p-3
                         sm:p-4 dark:border-amber-800 dark:bg-amber-950"
            >
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
                    Sign up to save your progress permanently.
                  </p>
                  <a
                    href="/signup"
                    className="mt-2 inline-block text-sm font-medium text-amber-900
                               underline hover:text-amber-700 dark:text-amber-100
                               dark:hover:text-amber-300"
                  >
                    Create Account
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Learn Header */}
          <div className="text-center">
            <h1 className="text-xl sm:text-2xl font-bold">
              Learn: {series.name} - Chapter {chapter.chapter_number}
            </h1>
            {chapter.title && (
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                {chapter.title}
              </p>
            )}
            <p className="text-muted-foreground mt-2 text-xs sm:text-sm">
              Answer each word correctly twice to master it
            </p>
          </div>

          {/* Learn Session */}
          <LearnSession seriesSlug={slug} chapter={chapter} />
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="flex justify-center gap-4 pt-4 sm:pt-6 border-t pb-4">
        <a
          href={`/browse/${slug}/${chapterNumber}`}
          className="text-xs sm:text-sm text-muted-foreground
                     hover:text-foreground transition-colors"
        >
          Chapter
        </a>
        <a
          href={`/study/${slug}/${chapterNumber}`}
          className="text-xs sm:text-sm text-muted-foreground
                     hover:text-foreground transition-colors"
        >
          Study
        </a>
        <a
          href="/library"
          className="text-xs sm:text-sm text-muted-foreground
                     hover:text-foreground transition-colors"
        >
          Library
        </a>
      </div>
    </div>
  )
}
