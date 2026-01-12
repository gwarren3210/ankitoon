import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfileData } from '@/lib/profile/profileData'
import { ProfileClient } from '@/components/profile/profileClient'

/**
 * Profile page server component.
 * Fetches profile data and renders client component.
 * Output: Profile page
 */
export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const isGuest = user.is_anonymous ?? true

  const profileData = await getProfileData(user.id)

  return <ProfileClient initialData={profileData} isGuest={isGuest} />
}
