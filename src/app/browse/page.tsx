import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAllSeries, getSeriesStatsBatch } from '@/lib/series/seriesData'
import { getSeriesProgressBatch } from '@/lib/series/progressData'
import { BrowseControls } from '@/components/browse/browseControls'

export default async function BrowsePage() {
  const user = await getAuthenticatedUser()
  
  if (!user) {
    redirect('/login')
  }

  const isAnonymous = user.is_anonymous
  const isAuthenticated = !isAnonymous

  const supabase = await createClient()

  // Fetch all series
  const allSeries = await getAllSeries(supabase)

  if (allSeries.length === 0) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="mx-auto max-w-7xl">
          {isAnonymous && renderGuestBanner()}
          <h1 className="mb-6 sm:mb-8 text-3xl sm:text-4xl font-bold text-foreground">
            Browse Series
          </h1>
          <div className="py-12 text-center">
            <p className="text-muted-foreground">
              No series available yet.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Batch fetch vocabulary stats for all series
  const seriesIds = allSeries.map(s => s.id)
  const vocabStatsMap = await getSeriesStatsBatch(supabase, seriesIds)

  // Batch fetch user progress if authenticated
  let progressMap = new Map()
  if (isAuthenticated) {
    progressMap = await getSeriesProgressBatch(
      supabase,
      user.id,
      seriesIds
    )
  }

  // Combine series data with stats and progress
  const seriesData = allSeries.map(series => ({
    series,
    vocabStats: vocabStatsMap.get(series.id) || {
      totalVocabulary: 0,
      uniqueTerms: 0,
      averageImportance: 0
    },
    progress: progressMap.get(series.id) || null
  }))

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">
        {isAnonymous && renderGuestBanner()}

        <BrowseControls
          seriesData={seriesData}
          isAuthenticated={isAuthenticated}
        />
      </div>
    </div>
  )
}

/**
 * Renders guest account banner.
 * Input: none
 * Output: Guest banner JSX
 */
function renderGuestBanner() {
  return (
    <div className="mb-6 rounded-lg border border-amber-200 
                    bg-amber-50 p-4 dark:border-amber-800 
                    dark:bg-amber-950">
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
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 
               11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="flex-1">
          <h3 className="font-semibold text-amber-900 
                         dark:text-amber-100">
            You&apos;re using a guest account
          </h3>
          <p className="mt-1 text-sm text-amber-800 
                        dark:text-amber-200">
            Sign up to save your progress permanently 
            and access it from any device.
          </p>
          <a
            href="/signup"
            className="mt-2 inline-block text-sm 
                       font-medium text-amber-900 
                       underline hover:text-amber-700 
                       dark:text-amber-100 
                       dark:hover:text-amber-300"
          >
            Create Account
          </a>
        </div>
      </div>
    </div>
  )
}

/**
 * Gets authenticated user from Supabase session
 * Input: none
 * Output: User object or null
 */
async function getAuthenticatedUser() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  return user
}

