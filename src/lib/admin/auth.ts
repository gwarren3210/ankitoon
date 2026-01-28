/**
 * Admin authentication utilities
 * Provides helper functions for admin role validation
 */

import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * Check if user has admin role
 * Input: user ID
 * Output: boolean indicating admin status
 */
export async function checkIsAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient()
  logger.debug({ userId }, 'Checking admin status')
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (error) {
    logger.error({ userId, error }, 'Error checking admin status')
    return false
  }

  const isAdmin = data?.role === 'admin'
  logger.debug({ userId, isAdmin, role: data?.role }, 'Admin check completed')
  return isAdmin
}

/**
 * Require admin access or throw 403
 * Input: user ID
 * Output: void (throws if not admin)
 */
export async function requireAdmin(userId: string): Promise<void> {
  const isAdmin = await checkIsAdmin(userId)
  
  if (!isAdmin) {
    logger.warn({ userId }, 'Admin access required but user is not admin')
    throw new Error('Admin access required')
  }
  
  logger.debug({ userId }, 'Admin access granted')
}

