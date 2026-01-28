import { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import {
  withErrorHandler,
  requireAdmin,
  successResponse,
  BadRequestError
} from '@/lib/api'

/**
 * Response type for job status.
 */
export interface JobStatusResponse {
  status: 'queued' | 'running' | 'completed' | 'failed'
  result?: {
    success: boolean
    chapterId?: string
    seriesSlug?: string
    chapterNumber?: number
    newWordsInserted?: number
    totalWordsInChapter?: number
    newGrammarInserted?: number
    totalGrammarInChapter?: number
    dialogueLinesCount?: number
    vocabularyExtracted?: number
    grammarExtracted?: number
  }
  error?: string
}

/**
 * Maps Inngest status strings to our simplified status.
 * Input: Inngest status string
 * Output: Simplified status
 */
function mapInngestStatus(
  inngestStatus: string
): 'queued' | 'running' | 'completed' | 'failed' {
  switch (inngestStatus) {
    case 'Completed':
      return 'completed'
    case 'Failed':
    case 'Cancelled':
      return 'failed'
    case 'Running':
      return 'running'
    default:
      return 'queued'
  }
}

/**
 * GET /api/admin/process-image/status
 * Polls Inngest for job status.
 * Input: jobId query parameter
 * Output: JobStatusResponse
 */
async function handler(request: NextRequest) {
  await requireAdmin()

  const jobId = request.nextUrl.searchParams.get('jobId')

  if (!jobId) {
    throw new BadRequestError('jobId query parameter is required')
  }

  // In development, check if we're using Inngest Dev Server
  const isDev = process.env.NODE_ENV === 'development'
  const inngestApiUrl = isDev
    ? 'http://127.0.0.1:8288'
    : 'https://api.inngest.com'

  // Use signing key for auth (required in production)
  const signingKey = process.env.INNGEST_SIGNING_KEY

  if (!isDev && !signingKey) {
    logger.error('INNGEST_SIGNING_KEY not configured')
    throw new Error('INNGEST_SIGNING_KEY not configured')
  }

  try {
    const response = await fetch(
      `${inngestApiUrl}/v1/events/${jobId}/runs`,
      {
        headers: signingKey
          ? { Authorization: `Bearer ${signingKey}` }
          : {}
      }
    )

    if (!response.ok) {
      // In dev mode, if Inngest Dev Server isn't running, return queued
      if (isDev && response.status === 404) {
        logger.warn({ jobId }, 'Inngest Dev Server not responding, assuming queued')
        return successResponse<JobStatusResponse>({
          status: 'queued'
        })
      }

      logger.error(
        { jobId, status: response.status },
        'Failed to fetch job status from Inngest'
      )
      throw new Error(`Failed to fetch job status: ${response.status}`)
    }

    const data = await response.json()
    const runs = data.data || []

    // No runs yet means still queued
    if (runs.length === 0) {
      return successResponse<JobStatusResponse>({
        status: 'queued'
      })
    }

    // Get the most recent run
    const latestRun = runs[0]
    const status = mapInngestStatus(latestRun.status)

    const result: JobStatusResponse = { status }

    if (status === 'completed' && latestRun.output) {
      result.result = latestRun.output
    }

    if (status === 'failed') {
      result.error = latestRun.output?.error || 'Processing failed'
    }

    logger.debug({ jobId, status }, 'Job status fetched')

    return successResponse(result)
  } catch (error) {
    // In dev mode, gracefully handle connection errors
    if (isDev) {
      logger.warn(
        { jobId, error: error instanceof Error ? error.message : String(error) },
        'Could not connect to Inngest Dev Server'
      )
      return successResponse<JobStatusResponse>({
        status: 'queued'
      })
    }

    throw error
  }
}

export const GET = withErrorHandler(handler)
