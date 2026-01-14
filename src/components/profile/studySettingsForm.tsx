'use client'

import { useState, FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { patchJson } from '@/lib/api/client'
import { Tables } from '@/types/database.types'

interface StudySettingsFormProps {
  profile: Tables<'profiles'>
  onUpdate: (profile: Tables<'profiles'>) => void
}

/**
 * Form for configuring study settings.
 * Input: profile, onUpdate callback
 * Output: Study settings form UI
 */
export function StudySettingsForm({ profile, onUpdate }: StudySettingsFormProps) {
  const [maxNewCards, setMaxNewCards] = useState(profile.max_new_cards ?? 10)
  const [maxTotalCards, setMaxTotalCards] = useState(profile.max_total_cards ?? 30)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    try {
      const response = await patchJson('/api/profile/settings', {
        max_new_cards: maxNewCards,
        max_total_cards: maxTotalCards,
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

  return (
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

          <div className="space-y-2">
            <Label htmlFor="max_new_cards">Max New Cards per Session</Label>
            <Input
              id="max_new_cards"
              type="number"
              min="1"
              max="50"
              value={maxNewCards}
              onChange={(e) => setMaxNewCards(parseInt(e.target.value) || 1)}
              disabled={loading}
            />
            <p className="text-sm text-muted-foreground">
              Maximum number of new cards to include in each study session (1-50)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max_total_cards">Max Total Cards per Session</Label>
            <Input
              id="max_total_cards"
              type="number"
              min="1"
              max="100"
              value={maxTotalCards}
              onChange={(e) => setMaxTotalCards(parseInt(e.target.value) || 1)}
              disabled={loading}
            />
            <p className="text-sm text-muted-foreground">
              Maximum total number of cards (new + review) in each study session (1-100)
            </p>
          </div>
          
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Saving...' : 'Save Settings'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

