import { Tables } from '@/types/database.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

type SeriesProgress = Tables<'user_series_progress_summary'>

interface SeriesProgressCardProps {
  progress: SeriesProgress
  totalChapters: number
}

/**
 * Displays user's progress summary for a series.
 * Input: progress data and total chapters
 * Output: Progress card component
 */
export function SeriesProgressCard({ progress, totalChapters }: SeriesProgressCardProps) {
  const completionRate = totalChapters > 0
    ? (progress.chapters_completed / totalChapters) * 100
    : 0

  const averageAccuracy = progress.average_accuracy
    ? Math.round(progress.average_accuracy * 100)
    : null

  return (
    <Card>
      <CardContent className="space-y-4">
        {/* Overall Completion */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Chapters Completed</span>
            <span>{progress.chapters_completed} / {totalChapters}</span>
          </div>
          <Progress value={completionRate} className="h-2" />
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{progress.cards_studied ?? 0}</div>
            <div className="text-sm text-muted-foreground">Cards Studied</div>
          </div>

          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{progress.total_cards || 0}</div>
            <div className="text-sm text-muted-foreground">Total Cards</div>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          {averageAccuracy !== null && (
            <div>
              <span className="text-muted-foreground">Average Accuracy:</span>
              <div className="font-medium">{averageAccuracy}%</div>
            </div>
          )}

          {progress.current_streak !== null && (
            <div>
              <span className="text-muted-foreground">Current Streak:</span>
              <div className="font-medium">{progress.current_streak} days</div>
            </div>
          )}

          {progress.last_studied && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Last Studied:</span>
              <div className="font-medium">
                {new Date(progress.last_studied).toLocaleDateString()}
              </div>
            </div>
          )}
        </div>

        {/* Time Spent */}
        {progress.total_time_spent_seconds && progress.total_time_spent_seconds > 0 && (
          <div className="pt-2 border-t">
            <div className="text-sm text-muted-foreground">Total Time Spent</div>
            <div className="font-medium">
              {formatTime(progress.total_time_spent_seconds)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Formats seconds into readable time string.
 * Input: seconds
 * Output: formatted time string
 */
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  } else {
    return `${remainingSeconds}s`
  }
}
