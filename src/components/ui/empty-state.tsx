/**
 * Empty state component featuring 또리 (Ttori) the tiger mascot.
 * Used across the app for various empty/error states.
 *
 * Usage:
 *   <EmptyState
 *     variant="library"
 *     title="Your library is empty"
 *     description="Start by browsing series"
 *     action={{ label: "Browse Series", href: "/browse" }}
 *   />
 */

import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type EmptyStateVariant =
  | 'library'
  | 'no-results'
  | 'complete'
  | 'error'
  | 'welcome'

interface EmptyStateAction {
  label: string
  href?: string
  onClick?: () => void
}

interface EmptyStateProps {
  /** The type of empty state to display */
  variant: EmptyStateVariant
  /** Main heading text */
  title: string
  /** Supporting description text */
  description?: string
  /** Optional action button */
  action?: EmptyStateAction
  /** Optional secondary action */
  secondaryAction?: EmptyStateAction
  /** Additional CSS classes */
  className?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Maps variant to image path and default alt text.
 */
const variantConfig: Record<
  EmptyStateVariant,
  { src: string; alt: string }
> = {
  library: {
    src: '/ttori/empty-library.png',
    alt: 'Ttori reading a book next to empty shelves',
  },
  'no-results': {
    src: '/ttori/empty-no-results.png',
    alt: 'Ttori looking confused with a magnifying glass',
  },
  complete: {
    src: '/ttori/celebration.png',
    alt: 'Ttori celebrating with confetti',
  },
  error: {
    src: '/ttori/empty-error.png',
    alt: 'Ttori bowing apologetically',
  },
  welcome: {
    src: '/ttori/welcome.png',
    alt: 'Ttori waving hello with Korean characters',
  },
}

/**
 * Size configurations for the illustration.
 */
const sizeConfig = {
  sm: { width: 120, height: 120, containerClass: 'max-w-xs' },
  md: { width: 180, height: 180, containerClass: 'max-w-sm' },
  lg: { width: 240, height: 240, containerClass: 'max-w-md' },
}

/**
 * Renders an action button, either as a link or button.
 */
function ActionButton({
  action,
  variant,
}: {
  action: EmptyStateAction
  variant: 'default' | 'outline'
}) {
  if (action.href) {
    return (
      <Button variant={variant} asChild>
        <Link href={action.href}>{action.label}</Link>
      </Button>
    )
  }

  return (
    <Button variant={variant} onClick={action.onClick}>
      {action.label}
    </Button>
  )
}

/**
 * Empty state component with 또리 illustrations.
 * Displays contextual illustrations for various empty/error states.
 *
 * @param variant - Type of empty state
 * @param title - Main heading text
 * @param description - Optional supporting text
 * @param action - Optional primary action button
 * @param secondaryAction - Optional secondary action button
 * @param size - Size of the illustration (sm, md, lg)
 */
export function EmptyState({
  variant,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = 'md',
}: EmptyStateProps) {
  const config = variantConfig[variant]
  const sizeSettings = sizeConfig[size]

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'px-4 py-8',
        sizeSettings.containerClass,
        'mx-auto',
        className
      )}
    >
      {/* 또리 Illustration */}
      <div className="relative mb-6">
        <Image
          src={config.src}
          alt={config.alt}
          width={sizeSettings.width}
          height={sizeSettings.height}
          className="object-contain"
          priority={variant === 'welcome' || variant === 'complete'}
        />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-muted-foreground mb-6 max-w-[280px]">
          {description}
        </p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {action && (
            <ActionButton action={action} variant="default" />
          )}
          {secondaryAction && (
            <ActionButton action={secondaryAction} variant="outline" />
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Celebration variant for study session completion.
 * Includes special styling for the achievement moment.
 */
export function CelebrationState({
  title = '잘했어! Great job!',
  description,
  action,
  secondaryAction,
  className,
}: Omit<EmptyStateProps, 'variant' | 'size'>) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'px-4 py-8',
        className
      )}
    >
      {/* Celebration illustration */}
      <div className="relative mb-6">
        <Image
          src="/ttori/celebration.png"
          alt="Ttori celebrating with confetti"
          width={200}
          height={200}
          className="object-contain"
          priority
        />
      </div>

      {/* Title with Korean styling */}
      <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-muted-foreground mb-6 max-w-[300px]">
          {description}
        </p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {action && (
            <ActionButton action={action} variant="default" />
          )}
          {secondaryAction && (
            <ActionButton action={secondaryAction} variant="outline" />
          )}
        </div>
      )}
    </div>
  )
}
