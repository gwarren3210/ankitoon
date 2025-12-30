'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

/**
 * Theme settings component for selecting light/dark/system theme.
 * Input: none
 * Output: Theme settings UI
 */
export function ThemeSettings() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Choose your preferred theme
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="theme">Theme</Label>
          <select
            id="theme"
            value={theme || 'system'}
            onChange={(e) => setTheme(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background 
                     px-3 py-1 text-sm shadow-xs focus-visible:outline-none 
                     focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
          <p className="text-sm text-muted-foreground">
            Select your preferred color theme
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

