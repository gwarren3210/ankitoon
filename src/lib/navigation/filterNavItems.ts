/**
 * Navigation filtering utilities
 * Provides role-based navigation item filtering
 */

import { NavItem } from '@/config/navigation'

export type UserRole = 'user' | 'admin' | null

/**
 * Filter navigation items based on user authentication and role
 * Input: navigation items array, user role (null = not authenticated)
 * Output: filtered array of visible navigation items
 */
export function filterNavItems(
  items: NavItem[],
  userRole: UserRole
): NavItem[] {
  return items.filter((item) => {
    if (item.visibility === 'public') {
      return userRole === null
    }
    if (item.visibility === 'authenticated') {
      return userRole !== null
    }
    if (item.visibility === 'admin') {
      return userRole === 'admin'
    }
    return false
  })
}

