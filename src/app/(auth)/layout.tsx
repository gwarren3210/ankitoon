import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ReactNode } from 'react'

type AuthLayoutProps = {
  children: ReactNode
}

/**
 * Layout for auth pages (login, signup).
 * Redirects authenticated users to /browse.
 * Input: children (ReactNode)
 * Output: children or redirect
 */
export default async function AuthLayout({ children }: AuthLayoutProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/browse')
  }

  return <>{children}</>
}
