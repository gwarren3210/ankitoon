import { NextRequest } from 'next/server'
import { processImageToDatabase } from '@/lib/pipeline/orchestrator'
import { logger } from '@/lib/logger'
import { extractImagesFromZip } from '@/lib/pipeline/zipExtractor'
import { stitchImageBuffers } from '@/lib/pipeline/imageStitcher'
import { createClient } from '@/lib/supabase/server'
import {
  withErrorHandler,
  requireAdmin,
  successResponse,
  BadRequestError,
  ExternalServiceError
} from '@/lib/api'

/**
 * Request body for process-image endpoint.
 * File is already uploaded to Supabase Storage; we receive the path.
 */
export interface ProcessImageRequest {
  storagePath: string
  seriesSlug: string
  chapterNumber: number
  chapterTitle?: string
  chapterLink?: string
}

/**
 * Response type for process-image endpoint.
 * Represents counts and chapter metadata after processing/upload.
 * Includes both vocabulary and grammar extraction results.
 */
export interface ProcessImageResponse {
  // Vocabulary results
  newWordsInserted: number
  totalWordsInChapter: number
  // Grammar results
  newGrammarInserted: number
  totalGrammarInChapter: number
  // Metadata
  seriesSlug: string
  chapterNumber: number
  dialogueLinesCount: number
  vocabularyExtracted: number
  grammarExtracted: number
}

/**
 * POST /api/admin/process-image
 * Downloads file from Supabase Storage and processes through OCR/AI pipeline.
 * Input: JSON body with storagePath, seriesSlug, chapterNumber, optional metadata
 * Output: ProcessImageResponse
 */
async function handler(request: NextRequest) {
  await requireAdmin()

  // Parse JSON body (not FormData)
  const body = await request.json() as ProcessImageRequest
  const { storagePath, seriesSlug, chapterNumber, chapterTitle, chapterLink } = body

  // Validate inputs
  if (!storagePath || !seriesSlug || !chapterNumber) {
    throw new BadRequestError('storagePath, seriesSlug, and chapterNumber are required')
  }

  // Security: Ensure path is in temp folder
  if (!storagePath.startsWith('temp/')) {
    throw new BadRequestError('Invalid storage path - must be in temp/ folder')
  }

  if (chapterNumber < 1) {
    throw new BadRequestError('chapterNumber must be a positive integer')
  }

  // Download file from Supabase Storage
  const supabase = await createClient()
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from('admin-uploads')
    .download(storagePath)

  if (downloadError) {
    logger.error({ storagePath, downloadError }, 'Failed to download from storage')
    throw new ExternalServiceError('Supabase Storage', downloadError.message)
  }

  // Convert to buffer
  const buffer = Buffer.from(await fileBlob.arrayBuffer())

  if (buffer.length === 0) {
    throw new BadRequestError('Downloaded file is empty')
  }

  // Determine if zip or image based on storage path
  let imageBuffer: Buffer

  if (storagePath.endsWith('.zip')) {
    const imageBuffers = await extractImagesFromZip(buffer)
    imageBuffer = await stitchImageBuffers(imageBuffers)
  } else {
    imageBuffer = buffer
  }

  try {
    // Process through pipeline
    const result = await processImageToDatabase(
      imageBuffer,
      seriesSlug,
      chapterNumber,
      chapterTitle,
      undefined,
      chapterLink
    )

    // Clean up temp file after successful processing
    const { error: deleteError } = await supabase.storage
      .from('admin-uploads')
      .remove([storagePath])

    if (deleteError) {
      logger.warn({ storagePath, deleteError }, 'Failed to delete temp file')
      // Don't throw - processing succeeded, cleanup is best-effort
    }

    const response: ProcessImageResponse = {
      newWordsInserted: result.newWordsInserted,
      totalWordsInChapter: result.totalWordsInChapter,
      newGrammarInserted: result.newGrammarInserted,
      totalGrammarInChapter: result.totalGrammarInChapter,
      seriesSlug: result.seriesSlug,
      chapterNumber: result.chapterNumber,
      dialogueLinesCount: result.dialogueLinesCount,
      vocabularyExtracted: result.vocabularyExtracted,
      grammarExtracted: result.grammarExtracted
    }

    logger.info(
      {
        storagePath,
        seriesSlug: result.seriesSlug,
        chapterNumber: result.chapterNumber,
        chapterId: result.chapterId,
        newWordsInserted: result.newWordsInserted,
        totalWordsInChapter: result.totalWordsInChapter,
        newGrammarInserted: result.newGrammarInserted,
        totalGrammarInChapter: result.totalGrammarInChapter,
        dialogueLinesCount: result.dialogueLinesCount,
        vocabularyExtracted: result.vocabularyExtracted,
        grammarExtracted: result.grammarExtracted
      },
      'Image processed successfully and temp file cleaned up'
    )

    return successResponse(response)
  } catch (error) {
    logger.error({ storagePath, seriesSlug, chapterNumber, error }, 'Pipeline error')
    throw new ExternalServiceError(
      'OCR/Translation pipeline',
      error instanceof Error ? error.message : 'Pipeline processing failed'
    )
  }
}

export const POST = withErrorHandler(handler)
