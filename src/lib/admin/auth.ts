/**
 * Admin authentication utilities
 * Provides helper functions for admin role validation
 */

import { logger } from '@/lib/pipeline/logger'
import { DbClient } from '../study/types'

/**
 * Check if user has admin role
 * Input: supabase client, user ID
 * Output: boolean indicating admin status
 */
export async function checkIsAdmin(
  supabase: DbClient, 
  userId: string
): Promise<boolean> {
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
 * Input: supabase client, user ID
 * Output: void (throws if not admin)
 */
export async function requireAdmin(
  supabase: DbClient, 
  userId: string
): Promise<void> {
  const isAdmin = await checkIsAdmin(supabase, userId)
  
  if (!isAdmin) {
    logger.warn({ userId }, 'Admin access required but user is not admin')
    throw new Error('Admin access required')
  }
  
  logger.debug({ userId }, 'Admin access granted')
}

