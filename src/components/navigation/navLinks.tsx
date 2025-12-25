'use client'

/**
 * NavLinks component
 * Renders navigation links with active state highlighting
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NavItem } from '@/config/navigation'
import { cn } from '@/lib/utils'

type NavLinksProps = {
  items: NavItem[]
  variant?: 'desktop' | 'mobile'
  onItemClick?: () => void
}

/**
 * Renders a list of navigation links
 * Input: nav items, variant (desktop/mobile), optional click handler
 * Output: styled navigation links
 */
export function NavLinks({ items, variant = 'desktop', onItemClick }: NavLinksProps) {
  const pathname = usePathname()

  return (
    <>
      {items.map((item) => {
        const isActive = pathname === item.href

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className={cn(
              'transition-colors',
              variant === 'desktop' && [
                'text-sm font-medium px-3 py-2 rounded-md',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent',
              ],
              variant === 'mobile' && [
                'block text-lg font-medium py-3 px-4 rounded-md',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-accent',
              ]
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </>
  )
}

