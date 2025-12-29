'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tables } from '@/types/database.types'
import { createClient } from '@/lib/supabase/client'

interface GuestConversionProps {
  onConversionSuccess: (profile: Tables<'profiles'>) => void
}

/**
 * Component for converting guest account to real account.
 * Input: onConversionSuccess callback
 * Output: Guest conversion form UI
 */
export function GuestConversion({ onConversionSuccess }: GuestConversionProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Invalid email format')
      return
    }

    if (username) {
      const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/
      if (!usernameRegex.test(username)) {
        setError('Username must be 3-20 characters and contain only letters, numbers, underscores, and hyphens')
        return
      }
    }

    setLoading(true)

    try {
      const supabase = createClient()

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Authentication required')
      }

      if (!user.is_anonymous) {
        throw new Error('Account is not a guest account')
      }

      if (username) {
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username)
          .single()

        if (existing) {
          throw new Error('Username already taken')
        }
      }

      const { error: emailError } = await supabase.auth.updateUser({
        email: email
      })

      if (emailError) {
        if (emailError.message.includes('already registered') || 
            emailError.message.includes('already exists')) {
          throw new Error('This email is already registered. Please sign in instead.')
        }
        throw new Error(emailError.message || 'Failed to update email')
      }

      const { error: passwordError } = await supabase.auth.updateUser({
        password: password
      })

      if (passwordError) {
        if (passwordError.message.includes('email') || 
            passwordError.message.includes('verify')) {
          throw new Error('Please verify your email first. Check your inbox for a verification link.')
        }
        throw new Error(passwordError.message || 'Failed to set password')
      }

      if (username) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ username })
          .eq('id', user.id)

        if (profileError) {
          console.error('Failed to update username:', profileError)
        }
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
      <CardHeader>
        <CardTitle>Convert to Real Account</CardTitle>
        <CardDescription>
          Create a permanent account to save your progress and access it from any device
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="convert_email">Email *</Label>
            <Input
              id="convert_email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="convert_password">Password *</Label>
            <Input
              id="convert_password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              minLength={6}
            />
            <p className="text-sm text-muted-foreground">
              At least 6 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="convert_confirm_password">Confirm Password *</Label>
            <Input
              id="convert_confirm_password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="convert_username">Username (optional)</Label>
            <Input
              id="convert_username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              placeholder="Enter username"
            />
            <p className="text-sm text-muted-foreground">
              3-20 characters, letters, numbers, underscores, and hyphens only
            </p>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Converting...' : 'Convert Account'}
          </Button>

          <p className="text-sm text-muted-foreground">
            Your progress and study data will be preserved when you convert your account.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}

