/**
 * Navbar component
 * Main navigation bar with desktop/mobile responsive layouts
 */

import { createClient } from '@/lib/supabase/server'
import { navigationItems, authNavigationItems, guestNavigationItems } from '@/config/navigation'
import { filterNavItems, UserRole } from '@/lib/navigation/filterNavItems'
import { NavbarClient } from '@/components/navigation/navbarClient'

/**
 * Server component that fetches user data and renders navbar
 * Output: responsive navbar with role-filtered navigation
 */
export async function Navbar() {
  const { user, userRole, isGuest } = await getUserAndRole()
  const filteredItems = filterNavItems(navigationItems, userRole, isGuest)
  const filteredAuthItems = filterNavItems(authNavigationItems, userRole, isGuest)
  const filteredGuestItems = filterNavItems(guestNavigationItems, userRole, isGuest)

  return (
    <NavbarClient
      items={filteredItems}
      authItems={filteredAuthItems}
      guestItems={filteredGuestItems}
      isAuthenticated={!!user}
      isGuest={isGuest}
    />
  )
}

/**
 * Fetch current user and their role from Supabase
 * Output: user object, role string, and guest status
 */
async function getUserAndRole(): Promise<{
  user: { id: string } | null
  userRole: UserRole
  isGuest: boolean
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, userRole: null, isGuest: false }
  }

  const isGuest = user.is_anonymous ?? false

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const userRole: UserRole = profile?.role === 'admin' ? 'admin' : 'user'

  return { user: { id: user.id }, userRole, isGuest }
}

