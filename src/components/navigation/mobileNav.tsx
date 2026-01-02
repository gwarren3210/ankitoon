'use client'

/**
 * MobileNav component
 * Hamburger menu with slide-out drawer for mobile navigation
 */

import { useState } from 'react'
import { useTheme } from 'next-themes'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/navigation/themeToggle'
import { NavItem } from '@/config/navigation'
import { NavLinks } from '@/components/navigation/navLinks'

type MobileNavProps = {
  items: NavItem[]
  authItems: NavItem[]
  guestItems: NavItem[]
}

/**
 * Renders mobile navigation drawer with hamburger trigger
 * Input: main nav items, auth nav items, guest nav items
 * Output: hamburger button with slide-out menu
 */
export function MobileNav({ items, authItems, guestItems }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const { theme, setTheme } = useTheme()

  const handleClose = () => setOpen(false)

  const isDarkMode = theme === 'dark'

  const toggleDarkMode = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light')
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden inline-flex items-center px-3 py-2"
        >
          <span className="text-lg font-medium">☰</span>
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle className="text-left">AnkiToon</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 mt-4">
          <NavLinks items={items} variant="mobile" onItemClick={handleClose} />
          {authItems.length > 0 && (
            <>
              <div className="h-px bg-border my-2" />
              <NavLinks
                items={authItems}
                variant="mobile"
                onItemClick={handleClose}
              />
            </>
          )}
          {guestItems.length > 0 && (
            <>
              <div className="h-px bg-border my-2" />
              <NavLinks
                items={guestItems}
                variant="mobile"
                onItemClick={handleClose}
              />
            </>
          )}
          <div className="h-px bg-border my-2" />
          <div className="flex items-center justify-between px-4 py-3 rounded-xl">
            <span className="text-base font-medium text-foreground">Dark Mode</span>
            <ThemeToggle
              checked={isDarkMode}
              onCheckedChange={toggleDarkMode}
              aria-label="Toggle dark mode"
            />
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}

