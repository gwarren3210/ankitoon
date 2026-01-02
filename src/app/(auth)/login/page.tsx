'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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

    const result = await signIn(email, password)
    
    if (result.error) {
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

    const result = await signInAnonymously()
    
    if (result.error) {
      setError(result.error)
      setGuestLoading(false)
      return
    }

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
                href="/signup" 
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
  const supabase = createClient()
  
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    return { error: formatAuthError(error.message) }
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
  const supabase = createClient()
  
  const { error } = await supabase.auth.signInAnonymously()

  if (error) {
    return { error: formatAuthError(error.message) }
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

