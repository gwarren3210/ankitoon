'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProfileData } from '@/lib/profile/profileData'
import { OverviewTab } from './overviewTab'
import { ActivityTab } from './activityTab'
import { SettingsTab } from './settingsTab'
import { GuestConversion } from './guestConversion'

interface ProfileClientProps {
  initialData: ProfileData
  isGuest: boolean
}

/**
 * Main client wrapper for profile page with tabs.
 * Input: initialData, isGuest
 * Output: Profile page UI
 */
export function ProfileClient({ initialData, isGuest }: ProfileClientProps) {
  const [profileData, setProfileData] = useState(initialData)

  const handleProfileUpdate = (updated: ProfileData['profile']) => {
    setProfileData((prev) => ({ ...prev, profile: updated }))
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl">
        {isGuest && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <GuestConversion onConversionSuccess={handleProfileUpdate} />
          </motion.div>
        )}

        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-4xl font-bold text-zinc-950 dark:text-zinc-50"
        >
          Profile
        </motion.h1>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <OverviewTab
              stats={profileData.stats}
              weeklyActivity={profileData.weeklyActivity}
              genreMastery={profileData.genreMastery}
            />
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <ActivityTab sessions={profileData.recentSessions} />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <SettingsTab
              profile={profileData.profile}
              onUpdate={handleProfileUpdate}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
