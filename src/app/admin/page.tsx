'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  SeriesSearch 
} from '@/components/admin/seriesSearch'
import { 
  ChapterInput 
} from '@/components/admin/chapterInput'
import { 
  ImageUpload 
} from '@/components/admin/imageUpload'
import { 
  ProcessingStatus 
} from '@/components/admin/processingStatus'

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
}

export default function AdminUploadPage() {
  const [selectedSeries, setSelectedSeries] = 
    useState<Series | null>(null)
  const [chapterNumber, setChapterNumber] = 
    useState<number | null>(null)
  const [uploadedFile, setUploadedFile] = 
    useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = 
    useState<ProcessingResult | null>(null)

  const canEnableChapter = selectedSeries !== null
  const canEnableUpload = canEnableChapter && 
    chapterNumber !== null
  const canProcess = canEnableUpload && uploadedFile !== null

  const handleReset = () => {
    setSelectedSeries(null)
    setChapterNumber(null)
    setUploadedFile(null)
    setResult(null)
  }

  const handleProcess = async () => {
    if (!canProcess || !uploadedFile || !selectedSeries || 
        chapterNumber === null) {
      return
    }

    setProcessing(true)
    setResult(null)

    const formData = new FormData()
    formData.append('image', uploadedFile)
    formData.append('seriesSlug', selectedSeries.slug)
    formData.append('chapterNumber', chapterNumber.toString())

    const response = await fetch('/api/admin/process-image', {
      method: 'POST',
      body: formData,
    })

    const data = await response.json()
    setProcessing(false)
    setResult(data)
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

          <ImageUpload
            disabled={!canEnableUpload}
            onFileSelected={setUploadedFile}
            file={uploadedFile}
          />

          <div className="flex gap-4">
            <Button
              onClick={handleProcess}
              disabled={!canProcess || processing}
              className="flex-1"
            >
              {processing ? 'Processing...' : 'Process Image'}
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

