import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProfileData } from '@/lib/profile/profileData'
import { logger } from '@/lib/logger'
import { profileUpdateSchema } from '@/lib/profile/schemas'
import {
  withErrorHandler,
  requireAuth,
  parseAndValidate,
  successResponse,
  DuplicateResourceError,
  DatabaseError
} from '@/lib/api'

/**
 * GET /api/profile
 * Fetch user profile with settings and aggregated stats.
 * Input: none (uses authenticated user)
 * Output: profile data with stats
 */
async function getHandler() {
  const { user } = await requireAuth()
  const profileData = await getProfileData(user.id)
  return successResponse(profileData)
}

/**
 * PATCH /api/profile
 * Update profile fields (username, avatar_url).
 * Input: username, avatar_url (optional)
 * Output: updated profile
 */
async function patchHandler(request: NextRequest) {
  const { user } = await requireAuth()
  const supabase = await createClient()
  const { username, avatar_url } = await parseAndValidate(
    request,
    profileUpdateSchema
  )

  const updates: { username?: string; avatar_url?: string } = {}

  if (username !== undefined) {
    if (username && typeof username === 'string' && username.length > 0) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .neq('id', user.id)
        .single()

      if (existing) {
        throw new DuplicateResourceError('Username', 'username')
      }

      updates.username = username
    } else {
      updates.username = undefined
    }
  }

  if (avatar_url !== undefined) {
    updates.avatar_url = avatar_url ?? undefined
  }

  const { data: updatedProfile, error: updateError } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single()

  if (updateError) {
    logger.error({ userId: user.id, updateError }, 'Error updating profile')
    throw new DatabaseError('Failed to update profile', updateError)
  }

  return successResponse({ profile: updatedProfile })
}

export const GET = withErrorHandler(getHandler)
export const PATCH = withErrorHandler(patchHandler)
