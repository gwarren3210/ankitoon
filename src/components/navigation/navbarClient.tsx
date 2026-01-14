'use client'

/**
 * NavbarClient component
 * Client-side navbar rendering with desktop and mobile views
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { NavItem } from '@/config/navigation'
import { NavLinks } from '@/components/navigation/navLinks'
import { MobileNav } from '@/components/navigation/mobileNav'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/navigation/themeToggle'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

type NavbarClientProps = {
  items: NavItem[]
  authItems: NavItem[]
  guestItems: NavItem[]
  isAuthenticated: boolean
  isGuest: boolean
}

/**
 * Renders the navbar UI
 * Input: filtered nav items, auth items, guest items, auth status, guest status
 * Output: responsive navbar
 */
export function NavbarClient({
  items,
  authItems,
  guestItems,
  isAuthenticated,
  isGuest,
}: NavbarClientProps) {
  const [isScrolled, setIsScrolled] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const isStudyPage = pathname?.startsWith('/study/')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const isDarkMode = mounted && theme === 'dark'

  const toggleDarkMode = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light')
  }

  /**
   * Handles user signout client-side (matches login pattern).
   * Input: none
   * Output: redirects to /login on success
   */
  const handleSignOut = async () => {
    setIsSigningOut(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error('Signout error:', error)
      }

      // Always redirect to login (even on error - user wants to sign out)
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Signout error:', error)
      // Still redirect on error
      router.push('/login')
      router.refresh()
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <nav
      className={cn(
        'sticky top-0 z-50 transition-all duration-300',
        isScrolled
          ? 'bg-background/80 backdrop-blur-lg shadow-md'
          : 'bg-background border border-border',
        isStudyPage && 'hidden md:block'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <MobileNav items={items} authItems={authItems} guestItems={guestItems} />

            <Link
              href="/"
              className="flex-shrink-0 flex items-center gap-2 group ml-2 md:ml-0"
            >
              <div className="relative w-10 h-10 flex items-center justify-center">
                <Image
                  src="/toonky-logo.png"
                  alt="Toonky"
                  width={40}
                  height={40}
                  className="object-contain"
                  priority
                />
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="font-bold text-xl text-foreground tracking-tight">
                  Toonky
                </span>
                <span className="text-[10px] text-muted-foreground font-medium -mt-1">
                  Learn Korean
                </span>
              </div>
            </Link>

            <nav className="hidden md:ml-10 md:flex md:space-x-2">
              <NavLinks items={items} variant="desktop" />
            </nav>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <div className="hidden sm:flex items-center gap-2">
              {mounted && (
                <ThemeToggle
                  checked={isDarkMode}
                  onCheckedChange={toggleDarkMode}
                  aria-label="Toggle dark mode"
                />
              )}

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

              {guestItems.map((item) => (
                <Button
                  key={item.href}
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              ))}
            </div>

            {isAuthenticated && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                disabled={isSigningOut}
              >
                {isSigningOut && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isSigningOut ? 'Signing Out...' : 'Sign Out'}
              </Button>
            )}

            <div className="flex items-center md:hidden gap-2">
              {mounted && (
                <ThemeToggle
                  checked={isDarkMode}
                  onCheckedChange={toggleDarkMode}
                  aria-label="Toggle dark mode"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

