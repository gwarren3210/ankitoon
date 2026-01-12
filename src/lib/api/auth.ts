/**
 * API Authentication Helpers
 * Provides consistent auth checking for API routes.
 */

import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { checkIsAdmin } from '@/lib/admin/auth'
import { logger } from '@/lib/logger'
import { UnauthorizedError, AdminRequiredError, ForbiddenError } from './errors'

/**
 * Result of authentication check.
 * Contains authenticated user.
 */
export interface AuthResult {
  user: User
}

/**
 * Authenticates request and returns user.
 * Throws UnauthorizedError if not authenticated.
 * Input: none (creates Supabase client internally)
 * Output: authenticated user
 */
export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error) {
    logger.warn({ error: error.message }, 'Authentication failed')
    throw new UnauthorizedError()
  }

  if (!user) {
    logger.warn('No user in auth response')
    throw new UnauthorizedError()
  }

  logger.debug({ userId: user.id }, 'User authenticated')
  return { user }
}

/**
 * Authenticates request and verifies admin role.
 * Throws UnauthorizedError or AdminRequiredError.
 * Input: none
 * Output: authenticated admin user
 */
export async function requireAdmin(): Promise<AuthResult> {
  const { user } = await requireAuth()

  const isAdmin = await checkIsAdmin(user.id)
  if (!isAdmin) {
    logger.warn({ userId: user.id }, 'Admin access required')
    throw new AdminRequiredError()
  }

  logger.debug({ userId: user.id }, 'Admin access granted')
  return { user }
}

/**
 * Verifies user owns a resource.
 * Throws ForbiddenError if user does not own resource.
 * Input: resource owner ID, current user ID, optional resource name
 * Output: void (throws if unauthorized)
 */
export function requireOwnership(
  resourceOwnerId: string,
  userId: string,
  resourceName = 'resource'
): void {
  if (resourceOwnerId !== userId) {
    logger.warn({
      userId,
      resourceOwnerId,
      resourceName
    }, 'Unauthorized access attempt')
    throw new ForbiddenError(`Not authorized to access this ${resourceName}`)
  }
}
