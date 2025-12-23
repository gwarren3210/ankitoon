import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkIsAdmin } from '@/lib/admin/auth'

/**
 * Response type for process-image-and-store endpoint
 * Represents counts and chapter metadata after processing/upload
 */ 
export interface ProcessImageAndStoreResponse {
  newWordsInserted: number
  totalWordsInChapter: number
  seriesSlug: string
  chapterNumber: number
}

/**
 * Process image through OCR and translation pipeline
 * Input: FormData with image, seriesSlug, chapterNumber
 * Output: ProcessImageAndStoreResponse
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' }, 
      { status: 401 }
    )
  }

  const isAdmin = await checkIsAdmin(supabase, user.id)
  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Admin access required' }, 
      { status: 403 }
    )
  }

  const formData = await request.formData()
  const image = formData.get('image') as File
  const seriesSlug = formData.get('seriesSlug') as string
  const chapterNumber = formData.get('chapterNumber') as string

  if (!image || !seriesSlug || !chapterNumber) {
    return NextResponse.json({
      success: false,
      message: 'Missing required fields',
    })
  }

  const encoreUrl = process.env.ENCORE_URL
  
  if (!encoreUrl) {
    return NextResponse.json({
      success: false,
      message: 'OCR service not configured',
    })
  }

  const imageBuffer = await image.arrayBuffer()
  const imageBlob = new Blob([imageBuffer])

  const ocrFormData = new FormData()
  ocrFormData.append('image', imageBlob, image.name)

  // Build query string with required/optional parameters
  const queryParams = new URLSearchParams({
    series_slug: seriesSlug,
    chapter_number: chapterNumber,
    user_id: user.id,
  })

  const chapterTitle = formData.get('chapterTitle') as string | null
  if (chapterTitle) queryParams.append('chapter_title', chapterTitle)

  const res = await fetch(
    `${encoreUrl}/process-image-and-store?${queryParams.toString()}`,
    {
      method: 'POST',
      body: ocrFormData,
    }
  )

  if (!res.ok) {
    return NextResponse.json(
        { error: 'OCR processing failed' },
        { status: 500 }
    )
  }

  const data: ProcessImageAndStoreResponse = await res.json()

  return NextResponse.json(data)
}
