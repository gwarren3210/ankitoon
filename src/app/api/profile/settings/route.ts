import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/pipeline/logger'

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

    const updates: {
      max_new_cards?: number
      max_total_cards?: number
    } = {}

    if (body.max_new_cards !== undefined) {
      if (typeof body.max_new_cards !== 'number' || 
          body.max_new_cards < 1 || 
          body.max_new_cards > 50) {
        return NextResponse.json(
          { error: 'max_new_cards must be between 1 and 50' },
          { status: 400 }
        )
      }
      updates.max_new_cards = body.max_new_cards
    }

    if (body.max_total_cards !== undefined) {
      if (typeof body.max_total_cards !== 'number' || 
          body.max_total_cards < 1 || 
          body.max_total_cards > 100) {
        return NextResponse.json(
          { error: 'max_total_cards must be between 1 and 100' },
          { status: 400 }
        )
      }
      updates.max_total_cards = body.max_total_cards
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
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

