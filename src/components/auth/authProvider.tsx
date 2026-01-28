'use client'

/**
 * AuthProvider component
 * Checks auth state and shows modal overlay when user is not authenticated
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
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
 * Provides auth state to children and shows modal when unauthenticated
 * Input: children (ReactNode)
 * Output: Auth context provider with modal overlay
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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

  const showModal = !isLoading && !user

  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      <div className={showModal ? 'auth-blur' : ''}>
        {children}
      </div>
      {showModal && <AuthModal />}
    </AuthContext.Provider>
  )
}
