import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates a Supabase client for browser-side usage.
 * NEXT_PUBLIC_ variables are baked in at build time, so server-side
 * validation in layout.tsx ensures they exist before the app runs.
 * Input: none
 * Output: Supabase browser client instance
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    throw new Error(
      'Supabase environment variables not configured. ' +
      'Ensure NEXT_PUBLIC_SUPABASE_URL and ' +
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set.'
    )
  }

  return createBrowserClient(url, key)
}