import { NextRequest } from 'next/server'
import { inngest } from '@/inngest/client'
import { logger } from '@/lib/logger'
import {
  withErrorHandler,
  requireAdmin,
  successResponse,
  BadRequestError
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
 * Response type for triggering processing.
 * Returns job ID for polling status.
 */
export interface ProcessImageResponse {
  jobId: string
  status: 'queued'
  message: string
}

/**
 * POST /api/admin/process-image
 * Triggers async processing via Inngest.
 * Returns immediately with job ID for status polling.
 * Input: JSON body with storagePath, seriesSlug, chapterNumber, optional metadata
 * Output: ProcessImageResponse with jobId
 */
async function handler(request: NextRequest) {
  await requireAdmin()

  // Parse JSON body
  const body = await request.json() as ProcessImageRequest
  const {
    storagePath,
    seriesSlug,
    chapterNumber,
    chapterTitle,
    chapterLink
  } = body

  // Validate inputs
  if (!storagePath || !seriesSlug || !chapterNumber) {
    throw new BadRequestError(
      'storagePath, seriesSlug, and chapterNumber are required'
    )
  }

  // Security: Ensure path is in temp folder
  if (!storagePath.startsWith('temp/')) {
    throw new BadRequestError('Invalid storage path - must be in temp/ folder')
  }

  if (chapterNumber < 1) {
    throw new BadRequestError('chapterNumber must be a positive integer')
  }

  // Enforce ZIP-only uploads
  if (!storagePath.endsWith('.zip')) {
    logger.error({ storagePath }, 'Non-ZIP file rejected')
    throw new BadRequestError(
      'Only ZIP files are supported. Please upload a ZIP archive.'
    )
  }

  // Send event to Inngest (returns immediately)
  const { ids } = await inngest.send({
    name: 'pipeline/chapter.process',
    data: {
      storagePath,
      seriesSlug,
      chapterNumber,
      chapterTitle,
      chapterLink
    }
  })

  const jobId = ids[0]

  logger.info(
    { jobId, storagePath, seriesSlug, chapterNumber },
    'Processing job queued'
  )

  const response: ProcessImageResponse = {
    jobId,
    status: 'queued',
    message: 'Processing started. Poll /api/admin/process-image/status for updates.'
  }

  return successResponse(response)
}

export const POST = withErrorHandler(handler)
