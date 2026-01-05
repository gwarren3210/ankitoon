'use client'

/**
 * ThemeToggle component
 * Custom toggle switch with sun/moon icons inside the thumb
 */

import * as SwitchPrimitives from '@radix-ui/react-switch'
import { Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

type ThemeToggleProps = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
  'aria-label'?: string
}

/**
 * Theme toggle with icons inside thumb
 * Input: checked state, change handler
 * Output: custom toggle switch
 */
export function ThemeToggle({
  checked,
  onCheckedChange,
  className,
  'aria-label': ariaLabel,
}: ThemeToggleProps) {
  return (
    <SwitchPrimitives.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-accent' : 'bg-input',
        className
      )}
      aria-label={ariaLabel}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          'pointer-events-none relative block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform flex items-center justify-center',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      >
        {checked ? (
          <Moon className="h-3.5 w-3.5 text-foreground" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-foreground" />
        )}
      </SwitchPrimitives.Thumb>
    </SwitchPrimitives.Root>
  )
}

