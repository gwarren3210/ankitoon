import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Tables } from '@/types/database.types'

type DbClient = SupabaseClient<Database>

/**
 * Gets user profile by user ID.
 * Input: supabase client, user id
 * Output: Profile record or null if not found
 */
export async function getProfileById(
  supabase: DbClient,
  userId: string
): Promise<Tables<'profiles'> | null> {
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
 * Input: supabase client, email
 * Output: Profile record or null if not found
 */
export async function getProfileByEmail(
  supabase: DbClient,
  email: string
): Promise<Tables<'profiles'> | null> {
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
 * Input: supabase client, array of user ids
 * Output: Map of user id to profile data
 */
export async function getProfilesBatch(
  supabase: DbClient,
  userIds: string[]
): Promise<Map<string, Tables<'profiles'>>> {
  if (userIds.length === 0) {
    return new Map()
  }

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
