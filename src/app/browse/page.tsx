import { createClient } from '@/lib/supabase/server'
import { getAllSeries, getSeriesStatsBatch } from '@/lib/series/seriesData'
import { getSeriesProgressBatch } from '@/lib/series/progressData'
import { BrowseControls } from '@/components/browse/browseControls'
import { GuestBanner } from '@/components/auth/guestBanner'

export default async function BrowsePage() {
  const user = await getAuthenticatedUser()

  // Auth modal handles unauthenticated users client-side
  // Show limited content when not authenticated
  const isAnonymous = user?.is_anonymous ?? false
  const isAuthenticated = user !== null && !isAnonymous

  // Fetch all series
  const allSeries = await getAllSeries()

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
  const vocabStatsMap = await getSeriesStatsBatch(seriesIds)

  // Batch fetch user progress if authenticated
  let progressMap = new Map()
  if (isAuthenticated && user) {
    progressMap = await getSeriesProgressBatch(
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
  return <div className="mb-6"><GuestBanner /></div>
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
