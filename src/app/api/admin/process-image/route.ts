import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkIsAdmin } from '@/lib/admin/auth'
import { processImageToDatabase } from '@/lib/pipeline/orchestrator'
import { logger } from '@/lib/logger'

/**
 * Response type for process-image endpoint.
 * Represents counts and chapter metadata after processing/upload.
 */ 
export interface ProcessImageResponse {
  newWordsInserted: number
  totalWordsInChapter: number
  seriesSlug: string
  chapterNumber: number
  dialogueLinesCount: number
  wordsExtracted: number
}

/**
 * Process image through OCR and translation pipeline.
 * Input: FormData with image, seriesSlug, chapterNumber
 * Output: ProcessImageResponse
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const authResult = await checkAdminAuth(supabase)

  if (authResult.error) {
    return authResult.error
  }

  const formResult = parseFormData(await request.formData())
  if (formResult.error) {
    logger.warn('Form data parsing failed')
    return formResult.error
  }

  const { image, seriesSlug, chapterNumber, chapterTitle, chapterLink } = formResult.data

  const validationError = validateInputs(image, seriesSlug, chapterNumber)
  if (validationError) {
    logger.warn({ seriesSlug, chapterNumber, imageSize: image.size }, 'Input validation failed')
    return validationError
  }

  try {
    const imageBuffer = Buffer.from(await image.arrayBuffer())
    
    if (imageBuffer.length === 0) {
      return NextResponse.json(
        { error: 'Image file is empty' },
        { status: 400 }
      )
    }

    const result = await processImageToDatabase(
      supabase,
      imageBuffer,
      seriesSlug,
      chapterNumber,
      chapterTitle,
      undefined,
      chapterLink
    )

    const response: ProcessImageResponse = {
      newWordsInserted: result.newWordsInserted,
      totalWordsInChapter: result.totalWordsInChapter,
      seriesSlug: result.seriesSlug,
      chapterNumber: result.chapterNumber,
      dialogueLinesCount: result.dialogueLinesCount,
      wordsExtracted: result.wordsExtracted
    }

    logger.info({
      seriesSlug: result.seriesSlug,
      chapterNumber: result.chapterNumber,
      chapterId: result.chapterId,
      newWordsInserted: result.newWordsInserted,
      totalWordsInChapter: result.totalWordsInChapter,
      dialogueLinesCount: result.dialogueLinesCount,
      wordsExtracted: result.wordsExtracted
    }, 'Image processed successfully')

    return NextResponse.json(response)
  } catch (error) {
    logger.error({ seriesSlug, chapterNumber, error }, 'Pipeline error')
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * Checks user authentication and admin status.
 * Input: supabase client
 * Output: error response or null
 */
async function checkAdminAuth(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (!user || authError) {
    logger.warn({ error: authError?.message }, 'Authentication failed for process-image')
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const isAdmin = await checkIsAdmin(supabase, user.id)
  if (!isAdmin) {
    logger.warn({ userId: user.id }, 'Admin access required for process-image')
    return {
      error: NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }
  }

  return { error: null }
}

type FormParseResult = {
  data: {
    image: File
    seriesSlug: string
    chapterNumber: number
    chapterTitle?: string
    chapterLink?: string
  }
  error: null
} | {
  data: null
  error: NextResponse
}

/**
 * Parses and validates form data from request.
 * Input: FormData object
 * Output: parsed data or error response
 */
function parseFormData(formData: FormData): FormParseResult {
  const image = formData.get('image') as File | null
  const seriesSlug = formData.get('seriesSlug') as string | null
  const chapterNumberStr = formData.get('chapterNumber') as string | null
  const chapterTitle = formData.get('chapterTitle') as string | null
  const chapterLink = formData.get('chapterLink') as string | null

  if (!image || !seriesSlug || !chapterNumberStr) {
    return {
      data: null,
      error: NextResponse.json(
        { error: 'Missing required fields: image, seriesSlug, chapterNumber' },
        { status: 400 }
      )
    }
  }

  const chapterNumber = parseInt(chapterNumberStr, 10)
  if (isNaN(chapterNumber) || chapterNumber < 1) {
    return {
      data: null,
      error: NextResponse.json(
        { error: 'chapterNumber must be a positive integer' },
        { status: 400 }
      )
    }
  }

  return {
    data: {
      image,
      seriesSlug,
      chapterNumber,
      chapterTitle: chapterTitle || undefined,
      chapterLink: chapterLink || undefined
    },
    error: null
  }
}

/**
 * Validates client inputs before processing.
 * Input: image file, series slug, chapter number
 * Output: error response or null
 */
function validateInputs(
  image: File,
  seriesSlug: string,
  chapterNumber: number
): NextResponse | null {
  if (!image || image.size === 0) {
    return NextResponse.json(
      { error: 'Image file is required and cannot be empty' },
      { status: 400 }
    )
  }

  if (!seriesSlug || seriesSlug.trim().length === 0) {
    return NextResponse.json(
      { error: 'Series slug is required' },
      { status: 400 }
    )
  }

  if (!Number.isInteger(chapterNumber) || chapterNumber < 1) {
    return NextResponse.json(
      { error: 'Chapter number must be a positive integer' },
      { status: 400 }
    )
  }

  return null
}
