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
              'transition-all duration-200',
              variant === 'desktop' && [
                'inline-flex items-center px-4 py-2 rounded-full text-sm font-medium',
                isActive
                  ? 'bg-primary/10 dark:bg-accent/30 text-primary dark:text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent',
              ],
              variant === 'mobile' && [
                'flex items-center px-4 py-3 rounded-xl text-base font-medium',
                isActive
                  ? 'bg-primary/10 dark:bg-accent/20 text-primary dark:text-accent-foreground'
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

