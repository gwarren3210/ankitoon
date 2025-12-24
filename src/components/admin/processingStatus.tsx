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
        ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
        : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
      }
    `}>
      <div className="space-y-2">
        <p className={`font-semibold ${
          result.success 
            ? 'text-green-900 dark:text-green-100' 
            : 'text-red-900 dark:text-red-100'
        }`}>
          {result.success ? 'Success!' : 'Error'}
        </p>
        
        <p className={
          result.success 
            ? 'text-green-700 dark:text-green-300' 
            : 'text-red-700 dark:text-red-300'
        }>
          {result.message}
          </p>

        {result.success && result.newWordsInserted && (
          <p className="text-sm text-green-600 dark:text-green-400">
            Created {result.newWordsInserted} vocabulary cards
          </p>
        )}
        {result.success && result.totalWordsInChapter && (
          <p className="text-sm text-green-600 dark:text-green-400">
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

