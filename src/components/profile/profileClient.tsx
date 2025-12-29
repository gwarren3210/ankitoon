'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProfileInfoForm } from '@/components/profile/profileInfoForm'
import { StudySettingsForm } from '@/components/profile/studySettingsForm'
import { ThemeSettings } from '@/components/profile/themeSettings'
import { ProfileStats } from '@/components/profile/profileStats'
import { AccountManagement } from '@/components/profile/accountManagement'
import { GuestConversion } from '@/components/profile/guestConversion'
import { ProfileData } from '@/lib/profile/profileData'

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
    setProfileData(prev => ({ ...prev, profile: updated }))
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl">
        {isGuest && (
          <div className="mb-6">
            <GuestConversion onConversionSuccess={handleProfileUpdate} />
          </div>
        )}

        <h1 className="mb-8 text-4xl font-bold text-zinc-950 dark:text-zinc-50">
          Profile
        </h1>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="info">Profile</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-6">
            <ProfileInfoForm
              profile={profileData.profile}
              onUpdate={handleProfileUpdate}
            />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <div className="space-y-6">
              <ThemeSettings />
              <StudySettingsForm
                profile={profileData.profile}
                onUpdate={handleProfileUpdate}
              />
            </div>
          </TabsContent>

          <TabsContent value="stats" className="mt-6">
            <ProfileStats stats={profileData.stats} />
          </TabsContent>

          <TabsContent value="account" className="mt-6">
            <AccountManagement isGuest={isGuest} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

