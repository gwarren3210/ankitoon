/**
 * Navigation configuration
 * Centralized definition of all navigation items with role-based visibility
 */

export type NavVisibility = 'public' | 'authenticated' | 'admin'

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
  { label: 'Admin', href: '/admin', visibility: 'admin' },
]

/**
 * Auth-related navigation items (shown separately)
 */
export const authNavigationItems: NavItem[] = [
  { label: 'Login', href: '/login', visibility: 'public' },
  { label: 'Sign Up', href: '/signup', visibility: 'public' },
]

