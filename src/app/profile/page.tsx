import { createClient } from '@/lib/supabase/server'
import { getProfileData } from '@/lib/profile/profileData'
import { ProfileClient } from '@/components/profile/profileClient'

/**
 * Profile page server component.
 * Fetches profile data and renders client component.
 * Auth modal handles unauthenticated users client-side.
 * Output: Profile page
 */
export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Show placeholder when not authenticated - modal will overlay
  if (!user) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-bold text-foreground">Profile</h1>
          <p className="mt-2 text-muted-foreground">
            Sign in to view your profile
          </p>
        </div>
      </div>
    )
  }

  const isGuest = user.is_anonymous ?? true

  const profileData = await getProfileData(user.id)

  return <ProfileClient initialData={profileData} isGuest={isGuest} />
}
