/**
 * Navigation configuration
 * Centralized definition of all navigation items with role-based visibility
 */

export type NavVisibility = 'public' | 'guest' | 'authenticated' | 'admin'

export type NavItem = {
  label: string
  href: string
  visibility: NavVisibility
}

/**
 * All navigation items
 * Add new pages here and they will appear in the navbar automatically
 */
export const navigationItems: NavItem[] = [
  { label: 'Browse', href: '/browse', visibility: 'authenticated' },
  { label: 'Library', href: '/library', visibility: 'authenticated' },
  { label: 'Profile', href: '/profile', visibility: 'authenticated' },
  { label: 'Admin', href: '/admin', visibility: 'admin' },
]

/**
 * Auth-related navigation items (shown separately)
 */
export const authNavigationItems: NavItem[] = [
  { label: 'Login', href: '/login', visibility: 'public' },
  // Removed Sign Up - users should convert guest accounts via profile page
]

/**
 * Guest-specific navigation items
 */
export const guestNavigationItems: NavItem[] = [
  { label: 'Convert to Account', href: '/profile', visibility: 'guest' },
]

