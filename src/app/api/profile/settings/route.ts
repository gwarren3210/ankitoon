import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { profileSettingsSchema } from '@/lib/profile/schemas'
import {
  withErrorHandler,
  requireAuth,
  parseAndValidate,
  successResponse,
  DatabaseError
} from '@/lib/api'

/**
 * PATCH /api/profile/settings
 * Update study settings.
 * Input: max_new_cards, max_total_cards
 * Output: updated profile
 */
async function handler(request: NextRequest) {
  const { user } = await requireAuth()
  const supabase = await createClient()
  const { max_new_cards, max_total_cards } = await parseAndValidate(
    request,
    profileSettingsSchema
  )

  const updates: {
    max_new_cards?: number
    max_total_cards?: number
  } = {}

  if (max_new_cards !== undefined) {
    updates.max_new_cards = max_new_cards
  }

  if (max_total_cards !== undefined) {
    updates.max_total_cards = max_total_cards
  }

  const { data: updatedProfile, error: updateError } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single()

  if (updateError) {
    logger.error({ userId: user.id, updateError }, 'Error updating settings')
    throw new DatabaseError('Failed to update settings', updateError)
  }

  return successResponse({ profile: updatedProfile })
}

export const PATCH = withErrorHandler(handler)
