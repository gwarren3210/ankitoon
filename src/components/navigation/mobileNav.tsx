'use client'

/**
 * MobileNav component
 * Hamburger menu with slide-out drawer for mobile navigation
 */

import { useState } from 'react'
import { Menu } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { NavItem } from '@/config/navigation'
import { NavLinks } from '@/components/navigation/navLinks'

type MobileNavProps = {
  items: NavItem[]
  authItems: NavItem[]
}

/**
 * Renders mobile navigation drawer with hamburger trigger
 * Input: main nav items, auth nav items
 * Output: hamburger button with slide-out menu
 */
export function MobileNav({ items, authItems }: MobileNavProps) {
  const [open, setOpen] = useState(false)

  const handleClose = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle className="text-left">AnkiToon</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-2 mt-4">
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
        </nav>
      </SheetContent>
    </Sheet>
  )
}

