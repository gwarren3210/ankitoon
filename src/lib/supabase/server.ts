import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getConfig } from '@/lib/config/env'

/**
 * Creates a Supabase client for server components/API routes.
 * Uses cookies for user authentication (respects RLS).
 * Input: none (reads cookies from request context)
 * Output: authenticated Supabase client
 */
export async function createClient() {
  const cookieStore = await cookies()
  const config = getConfig()

  return createServerClient(
    config.supabase.url,
    config.supabase.publishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/**
 * Creates a Supabase client with service role key (bypasses RLS).
 * Use for background jobs, Inngest functions, and admin operations
 * that don't have a user context.
 * Input: none (uses SUPABASE_SERVICE_ROLE_KEY env var)
 * Output: service role Supabase client
 */
export function createServiceRoleClient() {
  const config = getConfig()

  if (!config.supabase.serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY not configured. ' +
      'This is required for background jobs.'
    )
  }

  return createSupabaseClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}