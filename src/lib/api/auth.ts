/**
 * API Authentication Helpers
 * Provides consistent auth checking for API routes.
 */

import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { checkIsAdmin } from '@/lib/admin/auth'
import { logger } from '@/lib/logger'
import { UnauthorizedError, AdminRequiredError, ForbiddenError } from './errors'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/**
 * Result of authentication check.
 * Contains both user and supabase client for reuse.
 */
export interface AuthResult {
  user: User
  supabase: SupabaseClient
}

/**
 * Authenticates request and returns user and client.
 * Throws UnauthorizedError if not authenticated.
 * Input: none (creates Supabase client internally)
 * Output: authenticated user and Supabase client for reuse
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
  return { user, supabase }
}

/**
 * Authenticates request and verifies admin role.
 * Throws UnauthorizedError or AdminRequiredError.
 * Input: none
 * Output: authenticated admin user and Supabase client for reuse
 */
export async function requireAdmin(): Promise<AuthResult> {
  const { user, supabase } = await requireAuth()

  const isAdmin = await checkIsAdmin(supabase, user.id)
  if (!isAdmin) {
    logger.warn({ userId: user.id }, 'Admin access required')
    throw new AdminRequiredError()
  }

  logger.debug({ userId: user.id }, 'Admin access granted')
  return { user, supabase }
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
