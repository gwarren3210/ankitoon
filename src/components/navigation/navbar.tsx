/**
 * Navbar component
 * Main navigation bar with desktop/mobile responsive layouts
 */

import { createClient } from '@/lib/supabase/server'
import { navigationItems, authNavigationItems } from '@/config/navigation'
import { filterNavItems, UserRole } from '@/lib/navigation/filterNavItems'
import { NavbarClient } from '@/components/navigation/navbarClient'

/**
 * Server component that fetches user data and renders navbar
 * Output: responsive navbar with role-filtered navigation
 */
export async function Navbar() {
  const { user, userRole } = await getUserAndRole()
  const filteredItems = filterNavItems(navigationItems, userRole)
  const filteredAuthItems = filterNavItems(authNavigationItems, userRole)

  return (
    <NavbarClient
      items={filteredItems}
      authItems={filteredAuthItems}
      isAuthenticated={!!user}
    />
  )
}

/**
 * Fetch current user and their role from Supabase
 * Output: user object and role string
 */
async function getUserAndRole(): Promise<{
  user: { id: string } | null
  userRole: UserRole
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, userRole: null }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const userRole: UserRole = profile?.role === 'admin' ? 'admin' : 'user'

  return { user: { id: user.id }, userRole }
}

