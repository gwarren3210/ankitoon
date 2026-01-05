'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RecentSession } from '@/lib/profile/profileData'

interface ActivityTabProps {
  sessions: RecentSession[]
}

/**
 * Activity tab with recent study sessions list.
 * Input: sessions array
 * Output: Activity tab UI
 */
export function ActivityTab({ sessions }: ActivityTabProps) {
  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            No study sessions yet. Start studying to see your activity here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {sessions.map((session, i) => {
        const duration = session.endTime
          ? Math.round(
              (session.endTime.getTime() - session.startTime.getTime()) /
                60000
            )
          : 0

        return (
          <motion.div
            key={session.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Chapter Study Session</CardTitle>
                    <CardDescription>
                      {session.startTime.toLocaleDateString('en', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{session.cardsStudied}</div>
                    <div className="text-xs text-muted-foreground">cards</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div>{duration} min</div>
                  <div>{Math.round(session.accuracy * 100)}% accuracy</div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
