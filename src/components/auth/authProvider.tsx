'use client'

/**
 * AuthProvider component
 * Checks auth state and shows modal overlay when user is not authenticated.
 * On mobile devices, redirects to /login page instead of showing modal.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { AuthModal } from './authModal'

type AuthContextType = {
  user: User | null
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
})

export function useAuth() {
  return useContext(AuthContext)
}

type AuthProviderProps = {
  children: ReactNode
}

/**
 * Provides auth state to children and shows modal when unauthenticated (desktop)
 * or redirects to /login (mobile)
 * Input: children (ReactNode)
 * Output: Auth context provider with conditional modal overlay
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMobile, setIsMobile] = useState<boolean | null>(null)

  // Detect mobile on mount (same pattern as studyTips.tsx)
  useEffect(() => {
    setIsMobile('ontouchstart' in window || window.innerWidth < 768)
  }, [])

  // Check auth state
  useEffect(() => {
    const supabase = createClient()

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setIsLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }

    /**
     * Checks current user session
     * Input: none
     * Output: sets user state
     */
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setIsLoading(false)
    }
  }, [])

  // Redirect to login on mobile when unauthenticated
  useEffect(() => {
    if (!isLoading && !user && isMobile === true) {
      router.push('/login')
    }
  }, [isLoading, user, isMobile, router])

  // Wait for mobile detection before deciding what to show
  const needsAuth = !isLoading && !user && isMobile !== null
  const showModal = needsAuth && !isMobile

  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      <div className={showModal ? 'auth-blur' : ''}>
        {children}
      </div>
      {showModal && <AuthModal />}
    </AuthContext.Provider>
  )
}
