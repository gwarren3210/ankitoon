'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileStats, WeeklyActivityDay, GenreMastery } from '@/lib/profile/profileData'

interface OverviewTabProps {
  stats: ProfileStats
  weeklyActivity: WeeklyActivityDay[]
  genreMastery: GenreMastery[]
}

/**
 * Overview tab with stats cards, weekly chart, and genre mastery.
 * Input: stats, weeklyActivity, genreMastery
 * Output: Overview tab UI
 */
export function OverviewTab({
  stats,
  weeklyActivity,
  genreMastery
}: OverviewTabProps) {
  const statsCards = [
    {
      label: 'Cards Studied',
      value: stats.totalCardsStudied
    },
    {
      label: 'Cards Mastered',
      value: stats.totalCardsMastered
    },
    {
      label: 'Current Streak',
      value: `${stats.currentStreak} days`
    },
    {
      label: 'Accuracy',
      value: `${Math.round(stats.averageAccuracy * 100)}%`
    }
  ]

  const maxCount = Math.max(
    ...weeklyActivity.map(d => d.count),
    1
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{stat.label}</CardDescription>
                <CardTitle className="text-3xl">{stat.value}</CardTitle>
              </CardHeader>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Activity</CardTitle>
          <CardDescription>Cards studied over the last 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-2 h-40">
            {weeklyActivity.map((day, i) => {
              const height = (day.count / maxCount) * 100
              const dayName = new Date(day.date).toLocaleDateString('en', {
                weekday: 'short'
              })

              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center gap-2"
                >
                  <div className="w-full h-32 flex items-end justify-center">
                    <motion.div
                      className="w-full max-w-[40px] rounded-t bg-primary"
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{ duration: 0.5, delay: i * 0.1 }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {dayName}
                  </span>
                  <span className="text-xs font-medium">{day.count}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {genreMastery.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mastery by Genre</CardTitle>
            <CardDescription>Progress across different genres</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {genreMastery.map((genre, i) => (
                <div key={genre.genre} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{genre.genre}</span>
                    <span className="font-medium">{genre.percentage}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${genre.percentage}%` }}
                      transition={{ duration: 0.8, delay: i * 0.15 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}
