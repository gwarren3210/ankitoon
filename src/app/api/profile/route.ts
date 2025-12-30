import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProfileData } from '@/lib/profile/profileData'
import { logger } from '@/lib/pipeline/logger'
import { DbClient } from '@/lib/study/types'

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

    const updates: { username?: string; avatar_url?: string } = {}

    if (body.username !== undefined) {
      if (typeof body.username !== 'string') {
        return NextResponse.json(
          { error: 'Username must be a string' },
          { status: 400 }
        )
      }

      if (body.username.length > 0) {
        const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/
        if (!usernameRegex.test(body.username)) {
          return NextResponse.json(
            { error: 'Username must be 3-20 characters and contain only letters, numbers, underscores, and hyphens' },
            { status: 400 }
          )
        }

        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', body.username)
          .neq('id', user.id)
          .single()

        if (existing) {
          return NextResponse.json(
            { error: 'Username already taken' },
            { status: 409 }
          )
        }

        updates.username = body.username
      } else {
        updates.username = undefined
      }
    }

    if (body.avatar_url !== undefined) {
      if (typeof body.avatar_url !== 'string') {
        return NextResponse.json(
          { error: 'Avatar URL must be a string or null' },
          { status: 400 }
        )
      }
      updates.avatar_url = body.avatar_url ?? undefined
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