'use client'

import { useState, useEffect, FormEvent } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tables } from '@/types/database.types'

interface SettingsTabProps {
  profile: Tables<'profiles'>
  onUpdate: (profile: Tables<'profiles'>) => void
}

/**
 * Settings tab with appearance and study preferences.
 * Input: profile, onUpdate callback
 * Output: Settings tab UI
 */
export function SettingsTab({ profile, onUpdate }: SettingsTabProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [maxNewCards, setMaxNewCards] = useState(
    String(profile.max_new_cards ?? 10)
  )
  const [maxTotalCards, setMaxTotalCards] = useState(
    String(profile.max_total_cards ?? 30)
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDarkMode = theme === 'dark'

  const handleThemeToggle = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const newCardsNum = Number(maxNewCards)
    const totalCardsNum = Number(maxTotalCards)

    if (newCardsNum === 0 || totalCardsNum === 0) {
      setError('Values cannot be 0')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/profile/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_new_cards: newCardsNum,
          max_total_cards: totalCardsNum
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update settings')
      }

      onUpdate(data.profile)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings')
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose your preferred theme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="theme-toggle" className="text-base font-medium">
                Dark Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                Use dark theme
              </p>
            </div>
            <Switch
              id="theme-toggle"
              checked={isDarkMode}
              onCheckedChange={handleThemeToggle}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Study Settings</CardTitle>
          <CardDescription>
            Configure your study session preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <AlertDescription>Settings updated successfully</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between py-4 border-b border-border">
              <div>
                <Label htmlFor="max_new_cards" className="text-base font-medium">
                  New Cards per Session
                </Label>
                <p className="text-sm text-muted-foreground">
                  Maximum new cards to introduce
                </p>
              </div>
              <Input
                id="max_new_cards"
                type="number"
                min="0"
                max="50"
                value={maxNewCards}
                onChange={(e) => setMaxNewCards(e.target.value)}
                className="w-24"
              />
            </div>

            <div className="flex items-center justify-between py-4 border-b border-border">
              <div>
                <Label htmlFor="max_total_cards" className="text-base font-medium">
                  Max Cards per Session
                </Label>
                <p className="text-sm text-muted-foreground">
                  Total cards including reviews
                </p>
              </div>
              <Input
                id="max_total_cards"
                type="number"
                min="0"
                max="100"
                value={maxTotalCards}
                onChange={(e) => setMaxTotalCards(e.target.value)}
                className="w-24"
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  )
}
