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

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    
    const validationError = validateForm(password, confirmPassword)
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    const result = await signUp(email, password)
    
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    if (result.needsConfirmation) {
      setSuccess(true)
      setLoading(false)
    } else {
      router.push('/browse')
      router.refresh()
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center 
                      justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Check Your Email</CardTitle>
            <CardDescription>
              We sent a confirmation link to {email}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-green-50 p-4 
                            dark:bg-green-950">
              <p className="text-sm text-green-800 
                            dark:text-green-200">
                Please check your email and click the 
                confirmation link to activate your account.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Already confirmed?{' '}
              <a 
                href="/login" 
                className="font-medium text-foreground 
                           hover:underline"
              >
                Sign in
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center 
                    justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>
            Start learning Korean with webtoons
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
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                minLength={6}
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
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <a 
                href="/login" 
                className="font-medium text-foreground 
                           hover:underline"
              >
                Sign in
              </a>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

/**
 * Validates signup form fields
 * Input: password (string), confirmPassword (string)
 * Output: string | null (error message or null)
 */
function validateForm(
  password: string, 
  confirmPassword: string
): string | null {
  if (password.length < 6) {
    return 'Password must be at least 6 characters'
  }
  
  if (password !== confirmPassword) {
    return 'Passwords do not match'
  }
  
  return null
}

/**
 * Creates new user account with email and password
 * Input: email (string), password (string)
 * Output: { error: string | null, needsConfirmation: boolean }
 */
async function signUp(
  email: string, 
  password: string
): Promise<{ 
  error: string | null
  needsConfirmation: boolean 
}> {
  const supabase = createClient()
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/browse`
    }
  })

  if (error) {
    return { 
      error: formatAuthError(error.message),
      needsConfirmation: false
    }
  }

  const needsConfirmation = data.user?.identities?.length === 0
  
  return { 
    error: null,
    needsConfirmation 
  }
}

/**
 * Formats Supabase auth error to user-friendly message
 * Input: message (string)
 * Output: string
 */
function formatAuthError(message: string): string {
  if (message.includes('User already registered')) {
    return 'An account with this email already exists'
  }
  
  if (message.includes('Password')) {
    return 'Password must be at least 6 characters'
  }
  
  return message
}

