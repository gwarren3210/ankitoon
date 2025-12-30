'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  disabled: boolean
  seriesId: string | null
  onChapterValidated: (chapterNumber: number | null) => void
  value: number | null
}

/**
 * ChapterInput component
 * Validates chapter doesn't already exist in DB
 * Input: chapter number, series id
 * Output: calls onChapterValidated with validated number
 */
export function ChapterInput({ 
  disabled, 
  seriesId, 
  onChapterValidated,
  value 
}: Props) {
  const [chapter, setChapter] = useState('')
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateChapter = useCallback(async (
    chapterNum: string, 
    sId: string | null
  ) => {
    if (!chapterNum || !sId) {
      onChapterValidated(null)
      return
    }

    const num = parseInt(chapterNum)
    if (isNaN(num) || num < 1) {
      setError('Must be a positive number')
      onChapterValidated(null)
      return
    }

    setValidating(true)
    setError(null)

    const response = await fetch(
      `/api/admin/chapter/validate?` +
      `series_id=${sId}&chapter_number=${num}`
    )

    const data = await response.json()
    setValidating(false)

    if (data.exists) {
      setError('Chapter already exists')
      onChapterValidated(null)
    } else {
      onChapterValidated(num)
    }
  }, [onChapterValidated])

  useEffect(() => {
    if (!seriesId) {
      onChapterValidated(null)
      return
    }

    if (!chapter) {
      return
    }

    const timer = setTimeout(() => {
      validateChapter(chapter, seriesId)
    }, 500)

    return () => clearTimeout(timer)
  }, [chapter, seriesId, validateChapter, onChapterValidated])

  return (
    <div className="space-y-2">
      <Label 
        htmlFor="chapter-number"
        className={disabled ? 'text-muted-foreground' : ''}
      >
        Chapter Number
      </Label>
      <Input
        id="chapter-number"
        type="number"
        min="1"
        placeholder="Enter chapter number..."
        value={chapter}
        onChange={(e) => setChapter(e.target.value)}
        disabled={disabled}
      />
      {validating && (
        <p className="text-xs text-muted-foreground">
          Validating...
        </p>
      )}
      {error && (
        <p className="text-xs text-destructive">
          {error}
        </p>
      )}
      {!error && value !== null && (
        <p className="text-xs text-green-600">
          Chapter {value} is available
        </p>
      )}
    </div>
  )
}

