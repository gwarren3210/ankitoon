/**
 * Custom SVG icons for AnkiToon with Korean/webtoon aesthetic.
 * These icons complement Lucide icons with brand-specific designs.
 *
 * Usage:
 *   import { HomeHanok, FlashcardStudy } from '@/components/ui/custom-icons'
 *   <HomeHanok className="h-6 w-6" />
 *
 * All icons follow Lucide conventions:
 * - viewBox="0 0 24 24"
 * - stroke="currentColor" (inherits text color)
 * - strokeWidth="2", strokeLinecap="round", strokeLinejoin="round"
 * - fill="none" (outline style)
 */

import { type SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number | string
}

/**
 * Base wrapper for all custom icons.
 * Provides consistent props and accessibility.
 */
function IconWrapper({
  children,
  size = 24,
  className,
  ...props
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {children}
    </svg>
  )
}

// =============================================================================
// NAVIGATION ICONS
// =============================================================================

/**
 * Home icon with Korean hanok (traditional house) curved roof style.
 * Use for: Home/dashboard navigation
 */
export function HomeHanok(props: IconProps) {
  return (
    <IconWrapper aria-label="Home" {...props}>
      <path d="M3 12c0 0 2-3 9-3s9 3 9 3" />
      <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
      <path d="M9 20v-5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5" />
      <path d="M2 12l1-2 9-7 9 7 1 2" />
    </IconWrapper>
  )
}

/**
 * Search icon with Korean cross/plus character hint inside lens.
 * Use for: Search functionality
 */
export function SearchKorean(props: IconProps) {
  return (
    <IconWrapper aria-label="Search" {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
      <path d="M8 11h6" />
      <path d="M11 8v6" />
    </IconWrapper>
  )
}

/**
 * Menu icon with comic speech bubble accent dot.
 * Use for: Mobile navigation hamburger menu
 */
export function MenuWebtoon(props: IconProps) {
  return (
    <IconWrapper aria-label="Menu" {...props}>
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
      <circle cx="20" cy="6" r="1.5" fill="currentColor" />
    </IconWrapper>
  )
}

/**
 * Browse/explore icon showing grid of comic panels.
 * Use for: Series library, browse section
 */
export function BrowseExplore(props: IconProps) {
  return (
    <IconWrapper aria-label="Browse" {...props}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </IconWrapper>
  )
}

// =============================================================================
// STUDY ICONS
// =============================================================================

/**
 * Flashcard icon with stacked cards showing depth.
 * Use for: Study sessions, flashcard features
 */
export function FlashcardStudy(props: IconProps) {
  return (
    <IconWrapper aria-label="Flashcard" {...props}>
      <rect x="3" y="7" width="16" height="12" rx="2" />
      <rect x="5" y="5" width="16" height="12" rx="2" />
      <path d="M10 10h6M10 13h4" />
    </IconWrapper>
  )
}

/**
 * Open manhwa book with panel divisions and speech bubble.
 * Use for: Chapter/book representation
 */
export function BookManhwa(props: IconProps) {
  return (
    <IconWrapper aria-label="Book" {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2" />
      <line x1="12" y1="7" x2="12" y2="13" />
      <line x1="9" y1="10" x2="15" y2="10" />
      <path d="M16 8h2v3h-2z" />
    </IconWrapper>
  )
}

/**
 * Vocabulary/word card with Korean-style emphasis dot.
 * Use for: Vocabulary lists, word features
 */
export function VocabularyWord(props: IconProps) {
  return (
    <IconWrapper aria-label="Vocabulary" {...props}>
      <rect x="3" y="8" width="18" height="10" rx="2" />
      <path d="M7 12h3m2 0h5M7 15h10" />
      <circle cx="17" cy="15" r="1" fill="currentColor" />
    </IconWrapper>
  )
}

/**
 * Document page with folded corner for chapter navigation.
 * Use for: Chapter selection, page navigation
 */
export function ChapterPage(props: IconProps) {
  return (
    <IconWrapper aria-label="Chapter" {...props}>
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
      <path d="M8 13h2m-2 4h6" />
    </IconWrapper>
  )
}

// =============================================================================
// STATUS ICONS
// =============================================================================

/**
 * Circular progress indicator with animated endpoint.
 * Use for: Progress tracking, stats display
 */
export function ProgressCircle(props: IconProps) {
  return (
    <IconWrapper aria-label="Progress" {...props}>
      <circle cx="12" cy="12" r="10" opacity="0.2" />
      <path d="M12 2a10 10 0 0 1 7.07 2.93" />
      <circle cx="19.07" cy="4.93" r="1.5" fill="currentColor" />
    </IconWrapper>
  )
}

/**
 * Achievement star with Korean brush-style center accent.
 * Use for: Achievements, rewards, ratings
 */
export function StarAchievement(props: IconProps) {
  return (
    <IconWrapper aria-label="Achievement" {...props}>
      <path d="M12 2l2.4 7.4h7.8l-6.3 4.6 2.4 7.4-6.3-4.6-6.3 4.6 2.4-7.4-6.3-4.6h7.8z" />
      <path d="M12 8v8" opacity="0.3" />
    </IconWrapper>
  )
}

/**
 * Bold checkmark in circle with confident stroke.
 * Use for: Completion, success states
 */
export function CheckComplete(props: IconProps) {
  return (
    <IconWrapper aria-label="Complete" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12.5l2.5 2.5c.3.3.7.3 1 0L17 9.5" strokeWidth="2.5" />
    </IconWrapper>
  )
}

/**
 * Friendly alert circle with exclamation mark.
 * Use for: Warnings, errors, important notices
 */
export function ErrorWarning(props: IconProps) {
  return (
    <IconWrapper aria-label="Warning" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7v6" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </IconWrapper>
  )
}

/**
 * Celebration sparkle burst with Korean firework aesthetic.
 * Use for: Celebrations, achievements, success moments
 */
export function SparkleSuccess(props: IconProps) {
  return (
    <IconWrapper aria-label="Celebration" {...props}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.6" />
    </IconWrapper>
  )
}

// =============================================================================
// UTILITY ICONS
// =============================================================================

/**
 * User profile with hanbok collar suggestion on shoulders.
 * Use for: User profile, account settings
 */
export function ProfileUser(props: IconProps) {
  return (
    <IconWrapper aria-label="Profile" {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M6 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
      <path d="M9 8l-1-2m7 2l1-2" />
    </IconWrapper>
  )
}

/**
 * Settings gear with Korean circle symbol (won/hwa) in center.
 * Use for: Settings, preferences, configuration
 */
export function SettingsGear(props: IconProps) {
  return (
    <IconWrapper aria-label="Settings" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3m-2.8-7.2l-2.1 2.1M9.9 14.1l-2.1 2.1m12.4 0l-2.1-2.1M9.9 9.9L7.8 7.8" />
      <circle cx="12" cy="12" r="1" />
    </IconWrapper>
  )
}

/**
 * Manhwa book spines with varying heights - library collection.
 * Use for: User library, book collection
 */
export function LibraryCollection(props: IconProps) {
  return (
    <IconWrapper aria-label="Library" {...props}>
      <rect x="3" y="4" width="3" height="18" rx="0.5" />
      <rect x="8" y="2" width="3" height="20" rx="0.5" />
      <rect x="13" y="6" width="3" height="16" rx="0.5" />
      <rect x="18" y="4" width="3" height="18" rx="0.5" />
      <line x1="4.5" y1="9" x2="4.5" y2="9.5" />
      <line x1="9.5" y1="7" x2="9.5" y2="7.5" />
      <line x1="14.5" y1="11" x2="14.5" y2="11.5" />
      <line x1="19.5" y1="9" x2="19.5" y2="9.5" />
    </IconWrapper>
  )
}

/**
 * Plus inside speech bubble heart shape - add to favorites.
 * Use for: Adding new items, creating content
 */
export function AddPlus(props: IconProps) {
  return (
    <IconWrapper aria-label="Add" {...props}>
      <path d="M12 2c-1.5 0-2.5 0.5-3.5 1.5L7 5l-1.5 1.5C4.5 7.5 4 8.5 4 10c0 5 8 12 8 12s8-7 8-12c0-1.5-0.5-2.5-1.5-3.5L17 5l-1.5-1.5C14.5 2.5 13.5 2 12 2z" />
      <line x1="12" y1="8" x2="12" y2="14" />
      <line x1="9" y1="11" x2="15" y2="11" />
    </IconWrapper>
  )
}

/**
 * Heart with Korean check mark for confirmed favorite.
 * Use for: Favorites, likes, bookmarks
 */
export function HeartFavorite(props: IconProps) {
  return (
    <IconWrapper aria-label="Favorite" {...props}>
      <path d="M12 21s-8-5-8-11.5c0-2.5 1.5-4.5 4-4.5 1.5 0 3 1 4 2.5 1-1.5 2.5-2.5 4-2.5 2.5 0 4 2 4 4.5 0 6.5-8 11.5-8 11.5z" />
      <path d="M10 9l1.5 1.5L14 8" />
    </IconWrapper>
  )
}

// =============================================================================
// ICON REGISTRY
// =============================================================================

/**
 * All custom icons as a registry for dynamic usage.
 * Example: icons['HomeHanok'] returns the component
 */
export const customIcons = {
  // Navigation
  HomeHanok,
  SearchKorean,
  MenuWebtoon,
  BrowseExplore,
  // Study
  FlashcardStudy,
  BookManhwa,
  VocabularyWord,
  ChapterPage,
  // Status
  ProgressCircle,
  StarAchievement,
  CheckComplete,
  ErrorWarning,
  SparkleSuccess,
  // Utility
  ProfileUser,
  SettingsGear,
  LibraryCollection,
  AddPlus,
  HeartFavorite,
} as const

export type CustomIconName = keyof typeof customIcons
