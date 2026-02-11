/**
 * Guest account notification banner component
 *
 * Displays an amber-themed banner encouraging anonymous users to create an
 * account to save their progress permanently. Used across multiple pages
 * (learn, browse, study).
 *
 * @param className - Optional additional CSS classes for styling customization
 * @returns Server-rendered banner with info icon and signup link
 */

interface GuestBannerProps {
  /**
   * Optional additional CSS classes for styling customization
   */
  className?: string
}

export function GuestBanner({ className }: GuestBannerProps) {
  return (
    <div
      className={`rounded-lg border border-amber-200 bg-amber-50 p-3 sm:p-4
                  dark:border-amber-800 dark:bg-amber-950 ${className || ''}`}
    >
      <div className="flex items-start gap-3">
        <svg
          className="h-5 w-5 text-amber-600 dark:text-amber-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="flex-1">
          <h3 className="font-semibold text-amber-900 dark:text-amber-100">
            You&apos;re using a guest account
          </h3>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            Sign up to save your progress permanently and access it from any
            device.
          </p>
          <a
            href="/signup"
            className="mt-2 inline-block text-sm font-medium text-amber-900
                       underline hover:text-amber-700 dark:text-amber-100
                       dark:hover:text-amber-300"
          >
            Create Account
          </a>
        </div>
      </div>
    </div>
  )
}
