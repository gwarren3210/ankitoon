/**
 * Custom duotone icon set for AnkiToon.
 * Korean-inspired designs with navy primary and blue accent colors.
 *
 * Usage:
 *   import { IconFlashcard, IconHanok } from '@/components/ui/icons'
 *   <IconFlashcard className="size-6" />
 *
 * All icons use currentColor for primary and CSS variable for accent,
 * making them themeable via Tailwind classes.
 */

import { cn } from '@/lib/utils'

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string
  /** Accent color class, defaults to text-accent */
  accentClassName?: string
}

/**
 * Home icon with Korean hanok (traditional house) roof silhouette.
 * The curved roof line is distinctively Korean architecture.
 */
export function IconHanok({
  className,
  accentClassName = 'text-accent',
  ...props
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-6', className)}
      aria-label="Home"
      {...props}
    >
      {/* Hanok curved roof - primary */}
      <path
        d="M3 10.5C3 10.5 5 8 12 8C19 8 21 10.5 21 10.5"
        stroke="currentColor"
        fill="none"
      />
      {/* Roof peak decoration - accent */}
      <path
        d="M12 4L12 8"
        stroke="currentColor"
        className={accentClassName}
        strokeWidth="2.5"
      />
      {/* House body - primary */}
      <path
        d="M5 10.5V19C5 19.5523 5.44772 20 6 20H18C18.5523 20 19 19.5523 19 19V10.5"
        stroke="currentColor"
        fill="none"
      />
      {/* Door - accent */}
      <rect
        x="10"
        y="14"
        width="4"
        height="6"
        rx="0.5"
        stroke="currentColor"
        className={accentClassName}
        fill="none"
      />
    </svg>
  )
}

/**
 * Browse/Explore icon showing an open manhwa book with visible panels.
 * Represents the webtoon library browsing experience.
 */
export function IconManhwa({
  className,
  accentClassName = 'text-accent',
  ...props
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-6', className)}
      aria-label="Browse"
      {...props}
    >
      {/* Open book shape - primary */}
      <path
        d="M2 6C2 5 3 4 4 4H10C11 4 12 5 12 6V20C12 19 11 18 10 18H4C3 18 2 17 2 16V6Z"
        stroke="currentColor"
        fill="none"
      />
      <path
        d="M22 6C22 5 21 4 20 4H14C13 4 12 5 12 6V20C12 19 13 18 14 18H20C21 18 22 17 22 16V6Z"
        stroke="currentColor"
        fill="none"
      />
      {/* Panel divisions on left page - accent */}
      <path
        d="M5 8H9M5 11H9M5 14H7"
        stroke="currentColor"
        className={accentClassName}
        strokeWidth="1.5"
      />
      {/* Panel divisions on right page - accent */}
      <path
        d="M15 8H19M15 11H19M17 14H19"
        stroke="currentColor"
        className={accentClassName}
        strokeWidth="1.5"
      />
    </svg>
  )
}

/**
 * Flashcard/Study icon with two stacked cards and a hangul hint.
 * Core icon for the study experience.
 */
export function IconFlashcard({
  className,
  accentClassName = 'text-accent',
  ...props
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-6', className)}
      aria-label="Study"
      {...props}
    >
      {/* Back card (offset) - accent */}
      <rect
        x="5"
        y="3"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        className={accentClassName}
        fill="none"
      />
      {/* Front card - primary */}
      <rect
        x="3"
        y="7"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        fill="none"
      />
      {/* Hangul hint on front card (ㅎ shape simplified) - accent */}
      <path
        d="M7 11H13M10 11V15"
        stroke="currentColor"
        className={accentClassName}
        strokeWidth="1.5"
      />
      {/* Flip arrow - primary */}
      <path
        d="M19 14L21 12L19 10"
        stroke="currentColor"
        fill="none"
      />
      <path
        d="M21 12H18"
        stroke="currentColor"
        fill="none"
      />
    </svg>
  )
}

/**
 * Library icon showing vertical book spines like a manhwa collection.
 * Represents the user's personal deck library.
 */
export function IconLibrary({
  className,
  accentClassName = 'text-accent',
  ...props
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-6', className)}
      aria-label="Library"
      {...props}
    >
      {/* Book spines - alternating primary and accent */}
      <rect
        x="3"
        y="4"
        width="3"
        height="16"
        rx="0.5"
        stroke="currentColor"
        fill="none"
      />
      <rect
        x="7"
        y="6"
        width="3"
        height="14"
        rx="0.5"
        stroke="currentColor"
        className={accentClassName}
        fill="none"
      />
      <rect
        x="11"
        y="4"
        width="3"
        height="16"
        rx="0.5"
        stroke="currentColor"
        fill="none"
      />
      <rect
        x="15"
        y="7"
        width="3"
        height="13"
        rx="0.5"
        stroke="currentColor"
        className={accentClassName}
        fill="none"
      />
      <rect
        x="19"
        y="5"
        width="2"
        height="15"
        rx="0.5"
        stroke="currentColor"
        fill="none"
      />
    </svg>
  )
}

/**
 * Search icon with magnifying glass containing a hangul character hint.
 * Used for vocabulary and series search.
 */
export function IconSearch({
  className,
  accentClassName = 'text-accent',
  ...props
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-6', className)}
      aria-label="Search"
      {...props}
    >
      {/* Magnifying glass circle - primary */}
      <circle cx="10" cy="10" r="7" stroke="currentColor" fill="none" />
      {/* Handle - primary */}
      <path d="M15 15L21 21" stroke="currentColor" />
      {/* Hangul hint inside (글 simplified) - accent */}
      <path
        d="M7 8H13M10 8V12"
        stroke="currentColor"
        className={accentClassName}
        strokeWidth="1.5"
      />
    </svg>
  )
}

/**
 * Progress/Stats icon with circular progress and cloud accent.
 * Represents learning progress and statistics.
 */
export function IconProgress({
  className,
  accentClassName = 'text-accent',
  ...props
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-6', className)}
      aria-label="Progress"
      {...props}
    >
      {/* Progress circle track - primary (lighter) */}
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.3"
        fill="none"
      />
      {/* Progress arc (~70%) - accent */}
      <path
        d="M12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12"
        stroke="currentColor"
        className={accentClassName}
        strokeWidth="2.5"
        fill="none"
      />
      {/* Small cloud at progress point - accent */}
      <path
        d="M2 11C2.5 10.5 3.5 10.5 4 11C4.5 10.5 5.5 10.5 6 11"
        stroke="currentColor"
        className={accentClassName}
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  )
}

/**
 * Achievement/Star icon with Korean traditional pattern hint.
 * Used for achievements, favorites, and ratings.
 */
export function IconStar({
  className,
  accentClassName = 'text-accent',
  ...props
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-6', className)}
      aria-label="Achievement"
      {...props}
    >
      {/* Star shape - primary */}
      <path
        d="M12 2L14.9 8.6L22 9.3L17 14.1L18.2 21.2L12 17.8L5.8 21.2L7 14.1L2 9.3L9.1 8.6L12 2Z"
        stroke="currentColor"
        fill="none"
      />
      {/* Inner pattern (traditional Korean) - accent */}
      <circle
        cx="12"
        cy="12"
        r="3"
        stroke="currentColor"
        className={accentClassName}
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  )
}

/**
 * Profile icon with subtle Korean collar detail.
 * Used for user profile and settings navigation.
 */
export function IconProfile({
  className,
  accentClassName = 'text-accent',
  ...props
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-6', className)}
      aria-label="Profile"
      {...props}
    >
      {/* Head - primary */}
      <circle cx="12" cy="8" r="4" stroke="currentColor" fill="none" />
      {/* Body/shoulders - primary */}
      <path
        d="M4 20C4 17 7 14 12 14C17 14 20 17 20 20"
        stroke="currentColor"
        fill="none"
      />
      {/* Korean collar hint (V shape like hanbok) - accent */}
      <path
        d="M10 14L12 17L14 14"
        stroke="currentColor"
        className={accentClassName}
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  )
}

/**
 * Settings/Gear icon.
 * Standard settings with accent details.
 */
export function IconSettings({
  className,
  accentClassName = 'text-accent',
  ...props
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-6', className)}
      aria-label="Settings"
      {...props}
    >
      {/* Gear teeth - primary */}
      <path
        d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
        stroke="currentColor"
        fill="none"
      />
      <path
        d="M19.4 15C19.1 15.6 19.2 16.3 19.7 16.8L19.8 16.9C20.2 17.3 20.5 17.9 20.5 18.5C20.5 19.1 20.3 19.6 19.8 20.1C19.3 20.5 18.7 20.8 18.1 20.8C17.5 20.8 16.9 20.6 16.5 20.1L16.4 20C15.9 19.5 15.2 19.4 14.6 19.7C14 19.9 13.6 20.5 13.6 21.2V21.4C13.6 22.3 12.9 23 12 23C11.1 23 10.4 22.3 10.4 21.4V21.2C10.4 20.5 10 19.9 9.4 19.7C8.8 19.4 8.1 19.5 7.6 20L7.5 20.1C7.1 20.5 6.5 20.8 5.9 20.8C5.3 20.8 4.7 20.6 4.2 20.1C3.8 19.7 3.5 19.1 3.5 18.5C3.5 17.9 3.7 17.3 4.2 16.9L4.3 16.8C4.8 16.3 4.9 15.6 4.6 15C4.4 14.4 3.8 14 3.1 14H2.9C2 14 1.3 13.3 1.3 12.4C1.3 11.5 2 10.8 2.9 10.8H3.1C3.8 10.8 4.4 10.4 4.6 9.8C4.9 9.2 4.8 8.5 4.3 8L4.2 7.9C3.8 7.5 3.5 6.9 3.5 6.3C3.5 5.7 3.7 5.1 4.2 4.7C4.6 4.3 5.2 4 5.8 4C6.4 4 7 4.2 7.4 4.7L7.5 4.8C8 5.3 8.7 5.4 9.3 5.1H9.4C10 4.9 10.4 4.3 10.4 3.6V3.4C10.4 2.5 11.1 1.8 12 1.8C12.9 1.8 13.6 2.5 13.6 3.4V3.6C13.6 4.3 14 4.9 14.6 5.1C15.2 5.4 15.9 5.3 16.4 4.8L16.5 4.7C16.9 4.3 17.5 4 18.1 4C18.7 4 19.3 4.2 19.8 4.7C20.2 5.1 20.5 5.7 20.5 6.3C20.5 6.9 20.3 7.5 19.8 7.9L19.7 8C19.2 8.5 19.1 9.2 19.4 9.8V9.8C19.6 10.4 20.2 10.8 20.9 10.8H21.1C22 10.8 22.7 11.5 22.7 12.4C22.7 13.3 22 14 21.1 14H20.9C20.2 14 19.6 14.4 19.4 15V15Z"
        stroke="currentColor"
        fill="none"
        strokeWidth="1.5"
      />
      {/* Center dot - accent */}
      <circle
        cx="12"
        cy="12"
        r="1"
        fill="currentColor"
        className={accentClassName}
      />
    </svg>
  )
}

/**
 * Check/Complete icon inside a speech bubble.
 * Used for completion states and correct answers.
 */
export function IconCheck({
  className,
  accentClassName = 'text-accent',
  ...props
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-6', className)}
      aria-label="Complete"
      {...props}
    >
      {/* Speech bubble shape - primary */}
      <path
        d="M21 11.5C21 16.1944 16.9706 20 12 20C10.2289 20 8.57736 19.5212 7.15936 18.6831L3 20L4.3 16.5C3.47659 15.1769 3 13.5916 3 11.5C3 6.80558 7.02944 3 12 3C16.9706 3 21 6.80558 21 11.5Z"
        stroke="currentColor"
        fill="none"
      />
      {/* Checkmark - accent */}
      <path
        d="M8 11L11 14L16 9"
        stroke="currentColor"
        className={accentClassName}
        strokeWidth="2.5"
        fill="none"
      />
    </svg>
  )
}

/**
 * Error/Warning icon in manhwa style.
 * Used for error states and warnings.
 */
export function IconError({
  className,
  accentClassName = 'text-destructive',
  ...props
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-6', className)}
      aria-label="Error"
      {...props}
    >
      {/* Triangle warning shape - primary */}
      <path
        d="M12 3L22 20H2L12 3Z"
        stroke="currentColor"
        fill="none"
      />
      {/* Exclamation mark - accent (destructive) */}
      <path
        d="M12 9V13"
        stroke="currentColor"
        className={accentClassName}
        strokeWidth="2.5"
        fill="none"
      />
      <circle
        cx="12"
        cy="16"
        r="0.5"
        fill="currentColor"
        className={accentClassName}
      />
    </svg>
  )
}

/**
 * Add/Plus icon.
 * Used for adding new items.
 */
export function IconPlus({
  className,
  accentClassName = 'text-accent',
  ...props
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-6', className)}
      aria-label="Add"
      {...props}
    >
      {/* Circle background - primary (lighter) */}
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.3"
        fill="none"
      />
      {/* Plus sign - accent */}
      <path
        d="M12 7V17M7 12H17"
        stroke="currentColor"
        className={accentClassName}
        strokeWidth="2.5"
        fill="none"
      />
    </svg>
  )
}

/**
 * Menu/Hamburger icon.
 * Used for mobile navigation toggle.
 */
export function IconMenu({
  className,
  accentClassName = 'text-accent',
  ...props
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-6', className)}
      aria-label="Menu"
      {...props}
    >
      {/* Three lines - alternating */}
      <path d="M4 6H20" stroke="currentColor" />
      <path
        d="M4 12H20"
        stroke="currentColor"
        className={accentClassName}
      />
      <path d="M4 18H20" stroke="currentColor" />
    </svg>
  )
}

/**
 * Vocabulary/Word icon.
 * Represents individual vocabulary items.
 */
export function IconVocabulary({
  className,
  accentClassName = 'text-accent',
  ...props
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-6', className)}
      aria-label="Vocabulary"
      {...props}
    >
      {/* Speech bubble - primary */}
      <path
        d="M21 11.5C21 16.1944 16.9706 20 12 20C10.2289 20 8.57736 19.5212 7.15936 18.6831L3 20L4.3 16.5C3.47659 15.1769 3 13.5916 3 11.5C3 6.80558 7.02944 3 12 3C16.9706 3 21 6.80558 21 11.5Z"
        stroke="currentColor"
        fill="none"
      />
      {/* Hangul character hint (한) - accent */}
      <text
        x="12"
        y="13"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="8"
        fontWeight="bold"
        fill="currentColor"
        className={accentClassName}
      >
        한
      </text>
    </svg>
  )
}

/**
 * Chapter/Book icon.
 * Represents individual chapters.
 */
export function IconChapter({
  className,
  accentClassName = 'text-accent',
  ...props
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-6', className)}
      aria-label="Chapter"
      {...props}
    >
      {/* Book cover - primary */}
      <path
        d="M4 4C4 3 5 2 6 2H18C19 2 20 3 20 4V20C20 21 19 22 18 22H6C5 22 4 21 4 20V4Z"
        stroke="currentColor"
        fill="none"
      />
      {/* Spine detail - accent */}
      <path
        d="M8 2V22"
        stroke="currentColor"
        className={accentClassName}
        strokeWidth="1.5"
      />
      {/* Page lines - accent */}
      <path
        d="M12 7H16M12 11H16M12 15H14"
        stroke="currentColor"
        className={accentClassName}
        strokeWidth="1.5"
      />
    </svg>
  )
}

/**
 * Cloud pattern decorative element.
 * Based on Korean traditional cloud motif (구름문).
 */
export function IconCloud({
  className,
  accentClassName = 'text-accent',
  ...props
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-6', className)}
      aria-label="Cloud"
      {...props}
    >
      {/* Korean traditional cloud shape - primary and accent */}
      <path
        d="M4 14C4 14 5 12 8 12C8 12 8 9 11 9C14 9 14 12 14 12C17 12 18 14 18 14"
        stroke="currentColor"
        fill="none"
      />
      <path
        d="M6 17C6 17 7 15 10 15C13 15 14 17 14 17"
        stroke="currentColor"
        className={accentClassName}
        fill="none"
      />
      {/* Swirl detail - accent */}
      <path
        d="M18 11C19 10 20 10 21 11"
        stroke="currentColor"
        className={accentClassName}
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  )
}

/**
 * 또리 (Ttori) the tiger mascot - simplified icon version.
 * Used for small badges and indicators.
 */
export function IconTtori({
  className,
  ...props
}: Omit<IconProps, 'accentClassName'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-6', className)}
      aria-label="Ttori mascot"
      {...props}
    >
      {/* Tiger face circle */}
      <circle cx="12" cy="12" r="9" stroke="currentColor" fill="none" />
      {/* Ears */}
      <path
        d="M6 5L8 8M18 5L16 8"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      {/* Eyes */}
      <circle cx="9" cy="11" r="1.5" fill="currentColor" />
      <circle cx="15" cy="11" r="1.5" fill="currentColor" />
      {/* Nose */}
      <ellipse cx="12" cy="14" rx="1.5" ry="1" fill="currentColor" />
      {/* Stripes - using orange for tiger */}
      <path
        d="M7 8L9 10M17 8L15 10"
        stroke="#f97316"
        strokeWidth="1.5"
      />
      {/* Whiskers */}
      <path
        d="M6 14H9M15 14H18"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  )
}

// Export all icons as a named object for dynamic usage
export const Icons = {
  hanok: IconHanok,
  manhwa: IconManhwa,
  flashcard: IconFlashcard,
  library: IconLibrary,
  search: IconSearch,
  progress: IconProgress,
  star: IconStar,
  profile: IconProfile,
  settings: IconSettings,
  check: IconCheck,
  error: IconError,
  plus: IconPlus,
  menu: IconMenu,
  vocabulary: IconVocabulary,
  chapter: IconChapter,
  cloud: IconCloud,
  ttori: IconTtori,
} as const

export type IconName = keyof typeof Icons
