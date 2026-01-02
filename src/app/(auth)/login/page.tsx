'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    logger.info({ email, type: 'email_login' }, 'Login attempt started')
    const result = await signIn(email, password)
    
    if (result.error) {
      logger.error({ email, error: result.error, type: 'email_login' }, 'Login failed')
      setError(result.error)
      setLoading(false)
      return
    }


    router.push('/browse')
    router.refresh()
  }

  const handleGuestLogin = async () => {
    setError(null)
    setGuestLoading(true)

    logger.info({ type: 'guest_login' }, 'Guest login attempt started')
    const result = await signInAnonymously()
    
    if (result.error) {
      logger.error({ error: result.error, type: 'guest_login' }, 'Guest login failed')
      setError(result.error)
      setGuestLoading(false)
      return
    }

    const isDev = process.env.NODE_ENV === 'development'
    const logLevel = process.env.NEXT_PUBLIC_LOG_LEVEL || process.env.LOG_LEVEL || 'info'
    const shouldLogUserId = isDev || logLevel === 'debug'
    
    if (shouldLogUserId) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        logger.debug({ userId: user.id, type: 'guest_login' }, 'Guest login successful - user ID logged')
      }
    }
    
    logger.info({ type: 'guest_login' }, 'Guest login successful')
    router.push('/browse')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center 
                    justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login to AnkiToon</CardTitle>
          <CardDescription>
            Study Korean vocabulary through webtoons
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm 
                              text-red-800 dark:bg-red-950 
                              dark:text-red-200">
                {error}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || guestLoading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs 
                              uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or
                </span>
              </div>
            </div>

            <Button 
              type="button"
              variant="outline"
              className="w-full" 
              disabled={loading || guestLoading}
              onClick={handleGuestLogin}
            >
              {guestLoading ? 'Creating guest...' : 'Continue as Guest'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <a 
                href="/profile" 
                className="font-medium text-foreground 
                           hover:underline"
              >
                Sign up
              </a>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

/**
 * Signs in user with email and password
 * Input: email (string), password (string)
 * Output: { error: string | null }
 */
async function signIn(
  email: string, 
  password: string
): Promise<{ error: string | null }> {
  logger.debug({ email, type: 'signIn' }, 'Creating Supabase client')
  const supabase = createClient()
  
  logger.debug({ email, type: 'signIn' }, 'Calling signInWithPassword')
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    logger.error({ 
      email, 
      errorCode: error.status, 
      errorMessage: error.message,
      type: 'signIn' 
    }, 'Supabase sign in error')
    return { error: formatAuthError(error.message) }
  }

  if (data.user) {
    logger.debug({ 
      email, 
      userId: data.user.id,
      isAnonymous: data.user.is_anonymous,
      type: 'signIn' 
    }, 'User authenticated successfully')
  } else {
    logger.warn({ email, type: 'signIn' }, 'Sign in succeeded but no user data returned')
  }

  return { error: null }
}

/**
 * Signs in anonymously (guest mode)
 * Input: none
 * Output: { error: string | null }
 */
async function signInAnonymously(): Promise<{ 
  error: string | null
}> {
  logger.debug({ type: 'signInAnonymously' }, 'Creating Supabase client')
  const supabase = createClient()
  
  logger.debug({ type: 'signInAnonymously' }, 'Calling signInAnonymously')
  const { data, error } = await supabase.auth.signInAnonymously()

  if (error) {
    logger.error({ 
      errorCode: error.status, 
      errorMessage: error.message,
      type: 'signInAnonymously' 
    }, 'Supabase anonymous sign in error')
    return { error: formatAuthError(error.message) }
  }

  if (data.user) {
    const isDev = process.env.NODE_ENV === 'development'
    const logLevel = process.env.NEXT_PUBLIC_LOG_LEVEL || process.env.LOG_LEVEL || 'info'
    const shouldLogUserId = isDev || logLevel === 'debug'
    
    if (shouldLogUserId) {
      logger.debug({ 
        userId: data.user.id,
        isAnonymous: data.user.is_anonymous,
        type: 'signInAnonymously' 
      }, 'Anonymous user authenticated successfully')
    } else {
      logger.debug({ 
        isAnonymous: data.user.is_anonymous,
        type: 'signInAnonymously' 
      }, 'Anonymous user authenticated successfully')
    }
  } else {
    logger.warn({ type: 'signInAnonymously' }, 'Anonymous sign in succeeded but no user data returned')
  }

  return { error: null }
}

/**
 * Formats Supabase auth error to user-friendly message
 * Input: message (string)
 * Output: string
 */
function formatAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) {
    return 'Invalid email or password'
  }
  
  if (message.includes('Email not confirmed')) {
    return 'Please confirm your email address'
  }

  if (message.includes('Anonymous sign-ins are disabled')) {
    return 'Guest mode is currently disabled. Please sign up.'
  }
  
  return message
}

