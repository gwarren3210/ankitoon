'use client'

import { Button } from '@/components/ui/button'

type ProcessingResult = {
  success: boolean
  message: string
  seriesSlug?: string
  chapterNumber?: number
  newWordsInserted?: number
  totalWordsInChapter?: number
}

type Props = {
  result: ProcessingResult
}

/**
 * ProcessingStatus component
 * Displays success/failure message after processing
 * Input: result object with success status and message
 * Output: renders status UI
 */
export function ProcessingStatus({ result }: Props) {
  return (
    <div className={`
      p-4 rounded-md border
      ${result.success 
        ? 'bg-brand-green/10 border-brand-green/30 dark:bg-brand-green/20 dark:border-brand-green/40' 
        : 'bg-destructive/10 border-destructive/30 dark:bg-destructive/20 dark:border-destructive/40'
      }
    `}>
      <div className="space-y-2">
        <p className={`font-semibold ${
          result.success 
            ? 'text-brand-green dark:text-brand-green' 
            : 'text-destructive dark:text-destructive'
        }`}>
          {result.success ? 'Success' : 'Error'}
        </p>
        
        <p className={
          result.success 
            ? 'text-brand-green/90 dark:text-brand-green/80' 
            : 'text-destructive/90 dark:text-destructive/80'
        }>
          {result.message}
          </p>

        {result.success && result.newWordsInserted && (
          <p className="text-sm text-brand-green dark:text-brand-green/90">
            Created {result.newWordsInserted} vocabulary cards
          </p>
        )}
        {result.success && result.totalWordsInChapter && (
          <p className="text-sm text-brand-green dark:text-brand-green/90">
            Total words in chapter: {result.totalWordsInChapter}
          </p>
        )}

        {result.success && result.seriesSlug && result.chapterNumber && (
          <Button
            onClick={() => {
              window.location.href = 
                `/${result.seriesSlug}/${result.chapterNumber}`
            }}
            className="mt-2"
          >
            View Chapter
          </Button>
        )}
      </div>
    </div>
  )
}

