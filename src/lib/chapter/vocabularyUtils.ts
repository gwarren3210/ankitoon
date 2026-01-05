/**
 * Formats a date as relative time (e.g., "2 days ago", "3 hours ago").
 * Input: date string or null
 * Output: formatted relative time string
 */
export function formatRelativeTime(date: string | null | undefined): string {
  if (!date) return 'never'
  const now = new Date()
  const targetDate = new Date(date)
  const diffMs = now.getTime() - targetDate.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes} min ago`
  if (diffHours < 24) return `${diffHours} hr ago`
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffWeeks < 4) return `${diffWeeks} weeks ago`
  if (diffMonths < 12) return `${diffMonths} months ago`
  return `${diffYears} years ago`
}

/**
 * Formats a future date as relative time (e.g., "in 3 days", "due").
 * Input: date string or null
 * Output: formatted relative time string
 */
export function formatDueTime(date: string | null | undefined): string {
  if (!date) return 'not due'
  const now = new Date()
  const targetDate = new Date(date)
  const diffMs = targetDate.getTime() - now.getTime()
  
  if (diffMs < 0) return 'due'
  
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)

  if (diffMinutes < 60) return `in ${diffMinutes} min`
  if (diffHours < 24) return `in ${diffHours} hr`
  if (diffDays < 7) return `in ${diffDays} days`
  if (diffWeeks < 4) return `in ${diffWeeks} weeks`
  if (diffMonths < 12) return `in ${diffMonths} months`
  return 'not due soon'
}

/**
 * Gets color class for due date status.
 * Input: next due date string or null
 * Output: Tailwind color class string
 */
export function getDueDateColor(
  nextDue: string | null | undefined
): string {
  if (!nextDue) return 'text-muted-foreground'
  const now = new Date()
  const dueDate = new Date(nextDue)
  const diffMs = dueDate.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  
  if (diffDays < 0) return 'text-destructive'
  if (diffDays < 1) return 'text-brand-orange'
  return 'text-brand-green'
}

