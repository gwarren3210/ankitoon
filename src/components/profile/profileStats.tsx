'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileStats as ProfileStatsType } from '@/lib/profile/profileData'

interface ProfileStatsProps {
  stats: ProfileStatsType
}

/**
 * Displays user statistics and progress.
 * Input: stats object
 * Output: Statistics display UI
 */
export function ProfileStats({ stats }: ProfileStatsProps) {
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Cards Studied</CardDescription>
            <CardTitle className="text-3xl">{stats.totalCardsStudied}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Current Streak</CardDescription>
            <CardTitle className="text-3xl">{stats.currentStreak} days</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Study Time</CardDescription>
            <CardTitle className="text-3xl">
              {formatTime(stats.totalTimeSpentSeconds)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Accuracy</CardDescription>
            <CardTitle className="text-3xl">
              {(stats.averageAccuracy * 100).toFixed(1)}%
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Series Progress</CardTitle>
          <CardDescription>
            You&apos;re studying {stats.seriesCount} series
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Detailed series progress will be available soon.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

