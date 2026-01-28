import { createClient } from '@/lib/supabase/server'
import { Tables } from '@/types/database.types'

/**
 * Gets user profile by user ID.
 * Input: user id
 * Output: Profile record or null if not found
 */
export async function getProfileById(
  userId: string
): Promise<Tables<'profiles'> | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw error
  }

  return data
}

/**
 * Gets user profile by email.
 * Input: email
 * Output: Profile record or null if not found
 */
export async function getProfileByEmail(
  email: string
): Promise<Tables<'profiles'> | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw error
  }

  return data
}

/**
 * Gets multiple user profiles by their IDs in batch.
 * Input: array of user ids
 * Output: Map of user id to profile data
 */
export async function getProfilesBatch(
  userIds: string[]
): Promise<Map<string, Tables<'profiles'>>> {
  if (userIds.length === 0) {
    return new Map()
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('id', userIds)

  if (error) {
    throw error
  }

  const profilesMap = new Map<string, Tables<'profiles'>>()
  for (const profile of data || []) {
    profilesMap.set(profile.id, profile)
  }

  return profilesMap
}
