'use client'

/**
 * NavbarClient component
 * Client-side navbar rendering with desktop and mobile views
 */

import Link from 'next/link'
import { NavItem } from '@/config/navigation'
import { NavLinks } from '@/components/navigation/navLinks'
import { MobileNav } from '@/components/navigation/mobileNav'
import { Button } from '@/components/ui/button'

type NavbarClientProps = {
  items: NavItem[]
  authItems: NavItem[]
  isAuthenticated: boolean
}

/**
 * Renders the navbar UI
 * Input: filtered nav items, auth items, auth status
 * Output: responsive navbar
 */
export function NavbarClient({
  items,
  authItems,
  isAuthenticated,
}: NavbarClientProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
      <div className="container flex h-14 items-center px-4 md:px-6">
        <MobileNav items={items} authItems={authItems} />

        <Link href="/" className="flex items-center gap-2 font-semibold ml-2 md:ml-0">
          <span className="text-lg">AnkiToon</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-6">
          <NavLinks items={items} variant="desktop" />
        </nav>

        <div className="flex items-center gap-2 ml-auto">
          <div className="hidden md:flex items-center gap-2">
            {authItems.map((item) => (
              <Button
                key={item.href}
                variant={item.href === '/signup' ? 'default' : 'ghost'}
                size="sm"
                asChild
              >
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
          </div>
          {isAuthenticated && (
            <form action="/api/auth/signout" method="post">
              <Button variant="ghost" size="sm" type="submit">
                Sign Out
              </Button>
            </form>
          )}
        </div>
      </div>
    </header>
  )
}

