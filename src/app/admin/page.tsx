'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SeriesSearch } from '@/components/admin/seriesSearch'
import { ChapterInput } from '@/components/admin/chapterInput'
import { ImageUpload, UploadedFileInfo } from '@/components/admin/imageUpload'
import { ProcessingStatus } from '@/components/admin/processingStatus'
import { postJson } from '@/lib/api/client'

type Series = {
  id: string
  name: string
  slug: string
  picture_url: string | null
}

type ProcessingResult = {
  success: boolean
  message: string
  seriesSlug?: string
  chapterNumber?: number
  newWordsInserted?: number
  totalWordsInChapter?: number
  newGrammarInserted?: number
  totalGrammarInChapter?: number
}

const POLL_INTERVAL = 2000 // 2 seconds

export default function AdminUploadPage() {
  const [selectedSeries, setSelectedSeries] =
    useState<Series | null>(null)
  const [chapterNumber, setChapterNumber] =
    useState<number | null>(null)
  const [chapterLink, setChapterLink] =
    useState<string>('')
  const [uploadedFile, setUploadedFile] =
    useState<UploadedFileInfo | null>(null)
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [result, setResult] =
    useState<ProcessingResult | null>(null)

  const canEnableChapter = selectedSeries !== null
  const canEnableUpload = canEnableChapter &&
    chapterNumber !== null
  const canProcess = canEnableUpload && uploadedFile !== null

  /**
   * Polls for job status until complete or failed.
   */
  const pollJobStatus = useCallback(async (id: string) => {
    try {
      const response = await fetch(
        `/api/admin/process-image/status?jobId=${id}`
      )
      const data = await response.json()

      if (data.status === 'completed') {
        setResult({
          success: true,
          message: 'Chapter processed successfully!',
          seriesSlug: data.result?.seriesSlug,
          chapterNumber: data.result?.chapterNumber,
          newWordsInserted: data.result?.newWordsInserted,
          totalWordsInChapter: data.result?.totalWordsInChapter,
          newGrammarInserted: data.result?.newGrammarInserted,
          totalGrammarInChapter: data.result?.totalGrammarInChapter
        })
        setJobId(null)
        setProcessing(false)
      } else if (data.status === 'failed') {
        setResult({
          success: false,
          message: data.error || 'Processing failed'
        })
        setJobId(null)
        setProcessing(false)
      }
      // For 'queued' and 'running', keep polling
    } catch (error) {
      console.error('Polling error:', error)
      // Don't stop polling on transient errors
    }
  }, [])

  // Polling effect
  useEffect(() => {
    if (!jobId) return

    // Initial poll
    pollJobStatus(jobId)

    // Set up interval
    const interval = setInterval(() => {
      pollJobStatus(jobId)
    }, POLL_INTERVAL)

    return () => clearInterval(interval)
  }, [jobId, pollJobStatus])

  const handleReset = () => {
    setSelectedSeries(null)
    setChapterNumber(null)
    setChapterLink('')
    setUploadedFile(null)
    setJobId(null)
    setResult(null)
    setProcessing(false)
  }

  const handleUploadStart = () => {
    setUploading(true)
  }

  const handleUploadComplete = (upload: UploadedFileInfo) => {
    setUploadedFile(upload)
    setUploading(false)
  }

  const handleUploadError = (error: Error) => {
    console.error('Upload error:', error)
    setUploading(false)
  }

  const handleProcess = async () => {
    if (!canProcess || !uploadedFile || !selectedSeries ||
        chapterNumber === null) {
      return
    }

    setProcessing(true)
    setResult(null)

    try {
      const response = await postJson('/api/admin/process-image', {
        storagePath: uploadedFile.storagePath,
        seriesSlug: selectedSeries.slug,
        chapterNumber: chapterNumber,
        chapterLink: chapterLink.trim() || undefined
      })

      const data = await response.json()

      // API now returns jobId for async processing
      if (data.jobId) {
        setJobId(data.jobId)
        // Keep processing=true, polling will update status
      } else {
        // Fallback for any sync response
        setResult(data)
        setProcessing(false)
      }
    } catch (error) {
      console.error('Processing error:', error)
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Processing failed'
      })
      setProcessing(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">
        Admin Deck Upload
      </h1>
      <p className="text-muted-foreground mb-8">
        Create new chapter decks from webtoon screenshots
      </p>

      <Card className="p-6">
        <div className="space-y-8">
          <SeriesSearch
            onSeriesSelected={setSelectedSeries}
            selectedSeries={selectedSeries}
          />

          <ChapterInput
            key={selectedSeries?.id}
            disabled={!canEnableChapter}
            seriesId={selectedSeries?.id || null}
            onChapterValidated={setChapterNumber}
            value={chapterNumber}
          />

          <div className="space-y-2">
            <Label 
              htmlFor="chapter-link"
              className={!canEnableChapter ? 'text-muted-foreground' : ''}
            >
              Chapter Link (Optional)
            </Label>
            <Input
              id="chapter-link"
              type="url"
              placeholder="https://..."
              value={chapterLink}
              onChange={(e) => setChapterLink(e.target.value)}
              disabled={!canEnableChapter}
            />
            <p className="text-xs text-muted-foreground">
              Link to the original webtoon chapter
            </p>
          </div>

          <ImageUpload
            disabled={!canEnableUpload}
            onUploadComplete={handleUploadComplete}
            onUploadStart={handleUploadStart}
            onUploadError={handleUploadError}
            uploadedFile={uploadedFile}
          />

          <div className="flex gap-4">
            <Button
              onClick={handleProcess}
              disabled={!canProcess || processing || uploading}
              className="flex-1"
            >
              {uploading
                ? 'Uploading...'
                : processing
                ? 'Processing...'
                : 'Process Chapter'
              }
            </Button>
            
            <Button
              onClick={handleReset}
              variant="outline"
              disabled={processing}
            >
              Reset
            </Button>
          </div>

          {result && (
            <ProcessingStatus result={result} />
          )}
        </div>
      </Card>
    </div>
  )
}

