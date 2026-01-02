import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { profileSettingsSchema } from '@/lib/profile/schemas'

/**
 * PATCH /api/profile/settings
 * Update study settings.
 * Input: max_new_cards, max_total_cards
 * Output: updated profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.error('Authentication required: %s', authError)
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    let body: {
      max_new_cards?: number
      max_total_cards?: number
    }
    try {
      body = await request.json()
    } catch (error) {
      logger.error('Error parsing request body: %s', error)
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const validationResult = profileSettingsSchema.safeParse(body)
    if (!validationResult.success) {
      logger.warn({ 
        userId: user.id, 
        issues: validationResult.error.issues 
      }, 'Validation failed')
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validationResult.error.issues 
        },
        { status: 400 }
      )
    }

    const { max_new_cards, max_total_cards } = validationResult.data
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
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      )
    }

    logger.info({ userId: user.id, updates }, 'Settings updated successfully')

    return NextResponse.json({ profile: updatedProfile })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error({ error }, 'Error updating settings')
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}

