import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getSeriesBySlug,
  getSeriesChapters,
  getSeriesVocabStats,
  getChapterVocabCountsBatch
} from '@/lib/series/seriesData'
import { getSeriesProgress, getChaptersProgressBatch } from '@/lib/series/progressData'
import { SeriesHeader } from '@/components/series/seriesHeader'
import { ChapterList } from '@/components/series/chapterList'
import { SeriesProgressCard } from '@/components/series/seriesProgressCard'
import { Tables } from '@/types/database.types'
import { logger } from '@/lib/logger'
interface SeriesPageProps {
  params: Promise<{ slug: string }>
}

/**
 * Series overview page showing chapters and progress.
 * Input: series slug from URL params
 * Output: Server-rendered series page
 */
export default async function SeriesPage({ params }: SeriesPageProps) {
  const { slug } = await params
  const supabase = await createClient()

  // Get authenticated user (may be anonymous)
  const { data: { user } } = await supabase.auth.getUser()
  logger.info({
    slug,
    userId: user?.id,
    isAnonymous: user?.is_anonymous ?? false
  }, 'Series page accessed')

  // Fetch series data
  const series = await getSeriesBySlug(slug)
  if (!series) {
    logger.warn({ slug, userId: user?.id }, 'Series not found')
    notFound()
  }

  logger.info({
    slug,
    seriesId: series.id,
    userId: user?.id,
  }, 'Series page loaded successfully')

  // Fetch data in parallel batches based on dependencies
  // Batch 1: Independent fetches that only need series.id
  const [chapters, vocabStats, userProgress] = await Promise.all([
    getSeriesChapters(series.id),
    getSeriesVocabStats(series.id),
    user ? getSeriesProgress(user.id, series.id) : Promise.resolve(null)
  ])

  // Batch 2: Fetches that depend on chapter IDs
  const chapterIds = chapters.map(ch => ch.id)
  const [vocabCountMap, chapterProgressMap] = await Promise.all([
    getChapterVocabCountsBatch(chapterIds),
    user
      ? getChaptersProgressBatch(user.id, chapterIds)
      : Promise.resolve(new Map<string, Tables<'user_chapter_progress_summary'>>())
  ])

  // Merge all data into chapters
  const chaptersWithProgress = chapters.map(chapter => ({
    ...chapter,
    vocabularyCount: vocabCountMap.get(chapter.id) || 0,
    progress: chapterProgressMap.get(chapter.id)
  }))

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8">
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

        {/* Series Header */}
        <SeriesHeader series={series} vocabStats={vocabStats} />

        {/* User Progress Card (only for authenticated users) */}
        {userProgress && (
          <SeriesProgressCard progress={userProgress} totalChapters={chapters.length} />
        )}

        {/* Chapters List */}
        <ChapterList
          seriesSlug={slug}
          chapters={chaptersWithProgress}
        />
      </div>
    </div>
  )
}
