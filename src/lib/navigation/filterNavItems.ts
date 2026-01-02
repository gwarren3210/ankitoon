/**
 * Navigation filtering utilities
 * Provides role-based navigation item filtering
 */

import { NavItem } from '@/config/navigation'

export type UserRole = 'user' | 'admin' | null

/**
 * Filter navigation items based on user authentication and role
 * Input: navigation items array, user role (null = not authenticated), isGuest flag
 * Output: filtered array of visible navigation items
 */
export function filterNavItems(
  items: NavItem[],
  userRole: UserRole,
  isGuest: boolean = false
): NavItem[] {
  return items.filter((item) => {
    if (item.visibility === 'public') {
      return userRole === null
    }
    if (item.visibility === 'guest') {
      return isGuest
    }
    if (item.visibility === 'authenticated') {
      // Guests are authenticated users, just anonymous
      return userRole !== null
    }
    if (item.visibility === 'admin') {
      // Admins only, no guests
      return userRole === 'admin' && !isGuest
    }
    return false
  })
}

