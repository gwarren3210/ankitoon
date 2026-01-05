"use client"

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'

/**
 * Study tips component showing device-appropriate instructions.
 * Input: none
 * Output: Tips screen with desktop (keyboard) or mobile (swipe) instructions
 */
export function StudyTips() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkDevice = () => {
      setIsMobile('ontouchstart' in window || window.innerWidth < 768)
    }
    checkDevice()
    window.addEventListener('resize', checkDevice)
    return () => window.removeEventListener('resize', checkDevice)
  }, [])

  return (
    <div className="w-full max-w-2xl mx-auto py-12">
      <Card className="p-6 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Study Tips</h2>
          <p className="text-muted-foreground">
            Learn how to navigate your study session
          </p>
        </div>

        {isMobile ? (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-3">Swipe Gestures</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="font-medium text-accent min-w-[100px]">
                    Tap Card
                  </div>
                  <div className="text-muted-foreground">
                    Tap the flashcard to reveal the answer
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="font-medium text-brand-red min-w-[100px]">
                    ← Swipe Left
                  </div>
                  <div className="text-muted-foreground">
                    Again - You forgot the answer
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="font-medium text-brand-orange min-w-[100px]">
                    ↓ Swipe Down
                  </div>
                  <div className="text-muted-foreground">
                    Hard - You struggled to recall
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="font-medium text-accent min-w-[100px]">
                    → Swipe Right
                  </div>
                  <div className="text-muted-foreground">
                    Good - You recalled with effort
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="font-medium text-brand-green min-w-[100px]">
                    ↑ Swipe Up
                  </div>
                  <div className="text-muted-foreground">
                    Easy - You recalled easily
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-3">Keyboard Shortcuts</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="font-medium text-accent min-w-[120px]">
                    Space
                  </div>
                  <div className="text-muted-foreground">
                    Flip the card to reveal the answer
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="font-medium text-brand-red min-w-[120px]">
                    1 or ←
                  </div>
                  <div className="text-muted-foreground">
                    Again - You forgot the answer
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="font-medium text-brand-orange min-w-[120px]">
                    2 or ↓
                  </div>
                  <div className="text-muted-foreground">
                    Hard - You struggled to recall
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="font-medium text-accent min-w-[120px]">
                    3 or →
                  </div>
                  <div className="text-muted-foreground">
                    Good - You recalled with effort
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="font-medium text-brand-green min-w-[120px]">
                    4 or ↑
                  </div>
                  <div className="text-muted-foreground">
                    Easy - You recalled easily
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground text-center">
            Tips: Reveal the card before rating. Your rating affects when the
            card will appear again.
          </p>
        </div>
      </Card>
    </div>
  )
}
