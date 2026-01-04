import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProfileData } from '@/lib/profile/profileData'
import { logger } from '@/lib/logger'
import { DbClient } from '@/lib/study/types'
import { profileUpdateSchema } from '@/lib/profile/schemas'

/**
 * GET /api/profile
 * Fetch user profile with settings and aggregated stats.
 * Input: none (uses authenticated user)
 * Output: profile data with stats
 */
export async function GET() {
  try {
    const supabase: DbClient = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.error('Authentication required: %s', authError)
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const profileData = await getProfileData(supabase, user.id)

    return NextResponse.json(profileData)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error({ error }, 'Error fetching profile')
    
    return NextResponse.json(
      {
        error: 'Failed to fetch profile',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/profile
 * Update profile fields (username, avatar_url).
 * Input: username, avatar_url (optional)
 * Output: updated profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase: DbClient = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      logger.error('Authentication required: %s', authError)
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    let body: { username?: string; avatar_url?: string }
    try {
      body = await request.json()
    } catch (error) {
      logger.error('Error parsing request body: %s', error)
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const validationResult = profileUpdateSchema.safeParse(body)
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

    const { username, avatar_url } = validationResult.data
    const updates: { username?: string; avatar_url?: string } = {}

    if (username !== undefined) {
      if (username && typeof username === 'string' && username.length > 0) {
        // Check username uniqueness (can't be validated by Zod)
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username)
          .neq('id', user.id)
          .single()

        if (existing) {
          return NextResponse.json(
            { error: 'Username already taken' },
            { status: 409 }
          )
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
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    logger.info({ userId: user.id, updates }, 'Profile updated successfully')

    return NextResponse.json({ profile: updatedProfile })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error({ error }, 'Error updating profile')
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}