'use client'

/**
 * AuthModal component
 * Non-dismissible modal with tabbed login/signup forms
 */

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

/**
 * Renders non-dismissible auth modal with login/signup tabs
 * Input: none
 * Output: Modal overlay with auth forms
 */
export function AuthModal() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login')
  const [signupSuccess, setSignupSuccess] = useState(false)
  const [signupEmail, setSignupEmail] = useState('')

  const handleAuthSuccess = () => {
    router.refresh()
  }

  const handleSignupSuccess = (email: string) => {
    setSignupEmail(email)
    setSignupSuccess(true)
  }

  return (
    <DialogPrimitive.Root open={true}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/60
                     data-[state=open]:animate-in
                     data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-full max-w-md",
            "translate-x-[-50%] translate-y-[-50%]",
            "border bg-background p-6 shadow-lg sm:rounded-lg",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=open]:zoom-in-95"
          )}
        >
          <div className="flex flex-col space-y-1.5 text-center sm:text-left mb-4">
            <DialogPrimitive.Title className="text-lg font-semibold">
              Welcome to Toonky
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              Sign in to start learning Korean with webtoons
            </DialogPrimitive.Description>
          </div>

          {signupSuccess ? (
            <SignupSuccessMessage
              email={signupEmail}
              onBackToLogin={() => {
                setSignupSuccess(false)
                setActiveTab('login')
              }}
            />
          ) : (
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as 'login' | 'signup')}
            >
              <TabsList className="w-full">
                <TabsTrigger value="login" className="flex-1">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex-1">
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="min-h-[340px]">
                <LoginForm onSuccess={handleAuthSuccess} />
              </TabsContent>

              <TabsContent value="signup" className="min-h-[340px]">
                <SignupForm onSuccess={handleSignupSuccess} />
              </TabsContent>
            </Tabs>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

type LoginFormProps = {
  onSuccess: () => void
}

/**
 * Login form with email/password and guest option
 * Input: onSuccess callback
 * Output: Login form UI
 */
function LoginForm({ onSuccess }: LoginFormProps) {
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
      logger.error(
        { email, error: result.error, type: 'email_login' },
        'Login failed'
      )
      setError(result.error)
      setLoading(false)
      return
    }

    onSuccess()
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

    logger.info({ type: 'guest_login' }, 'Guest login successful')
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading || guestLoading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">Password</Label>
        <Input
          id="login-password"
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading || guestLoading}
        />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800
                        dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

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
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
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
    </form>
  )
}

type SignupFormProps = {
  onSuccess: (email: string) => void
}

/**
 * Signup form with email/password/confirm
 * Input: onSuccess callback with email
 * Output: Signup form UI
 */
function SignupForm({ onSuccess }: SignupFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const validationError = validateSignupForm(password, confirmPassword)
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
      onSuccess(email)
    } else {
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <Input
          id="signup-password"
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
        <Label htmlFor="signup-confirm">Confirm Password</Label>
        <Input
          id="signup-confirm"
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
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800
                        dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={loading}
      >
        {loading ? 'Creating account...' : 'Sign Up'}
      </Button>
    </form>
  )
}

type SignupSuccessMessageProps = {
  email: string
  onBackToLogin: () => void
}

/**
 * Email confirmation success message
 * Input: email address and back to login handler
 * Output: Success message UI
 */
function SignupSuccessMessage({ email, onBackToLogin }: SignupSuccessMessageProps) {
  return (
    <div className="space-y-4 py-4">
      <div className="rounded-md bg-green-50 p-4 dark:bg-green-950">
        <h3 className="font-medium text-green-800 dark:text-green-200">
          Check Your Email
        </h3>
        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
          We sent a confirmation link to {email}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Already confirmed?{' '}
        <button
          onClick={onBackToLogin}
          className="font-medium text-foreground hover:underline"
        >
          Sign in
        </button>
      </p>
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
async function signInAnonymously(): Promise<{ error: string | null }> {
  const supabase = createClient()

  const { error } = await supabase.auth.signInAnonymously()

  if (error) {
    return { error: formatAuthError(error.message) }
  }

  return { error: null }
}

/**
 * Creates new user account with email and password
 * Input: email (string), password (string)
 * Output: { error: string | null, needsConfirmation: boolean }
 */
async function signUp(
  email: string,
  password: string
): Promise<{ error: string | null; needsConfirmation: boolean }> {
  const supabase = createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}${window.location.pathname}`
    }
  })

  if (error) {
    return { error: formatAuthError(error.message), needsConfirmation: false }
  }

  const needsConfirmation = data.user?.identities?.length === 0

  return { error: null, needsConfirmation }
}

/**
 * Validates signup form fields
 * Input: password (string), confirmPassword (string)
 * Output: string | null (error message or null)
 */
function validateSignupForm(
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

  if (message.includes('User already registered')) {
    return 'An account with this email already exists'
  }

  if (message.includes('Password')) {
    return 'Password must be at least 6 characters'
  }

  return message
}
