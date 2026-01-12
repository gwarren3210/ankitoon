import { NextRequest } from 'next/server'
import { processImageToDatabase } from '@/lib/pipeline/orchestrator'
import { logger } from '@/lib/logger'
import { extractImagesFromZip } from '@/lib/pipeline/zipExtractor'
import { stitchImageBuffers } from '@/lib/pipeline/imageStitcher'
import {
  withErrorHandler,
  requireAdmin,
  successResponse,
  BadRequestError,
  ExternalServiceError,
  getFormString,
  getFormNumber,
  getFormFile
} from '@/lib/api'

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
 * POST /api/admin/process-image
 * Process image through OCR and translation pipeline.
 * Input: FormData with image/zip, seriesSlug, chapterNumber, optional chapterTitle, chapterLink
 * Output: ProcessImageResponse
 */
async function handler(request: NextRequest) {
  await requireAdmin()

  const formData = await request.formData()

  const image = getFormFile(formData, 'image')
  const zip = getFormFile(formData, 'zip')
  const seriesSlug = getFormString(formData, 'seriesSlug')
  const chapterNumber = getFormNumber(formData, 'chapterNumber')
  const chapterTitle = getFormString(formData, 'chapterTitle')
  const chapterLink = getFormString(formData, 'chapterLink')

  if (!seriesSlug) {
    throw new BadRequestError('seriesSlug is required')
  }

  if (!chapterNumber || chapterNumber < 1) {
    throw new BadRequestError('chapterNumber must be a positive integer')
  }

  if (!image && !zip) {
    throw new BadRequestError('Either image or zip file is required')
  }

  let imageBuffer: Buffer

  if (zip) {
    const imageBuffers = await extractImagesFromZip(
      Buffer.from(await zip.arrayBuffer())
    )

    imageBuffer = await stitchImageBuffers(imageBuffers)
  } else if (image) {
    imageBuffer = Buffer.from(await image.arrayBuffer())

    if (imageBuffer.length === 0) {
      throw new BadRequestError('Image file is empty')
    }
  } else {
    throw new BadRequestError('Either image or zip file is required')
  }

  try {
    const result = await processImageToDatabase(
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

    logger.info(
      {
        seriesSlug: result.seriesSlug,
        chapterNumber: result.chapterNumber,
        chapterId: result.chapterId,
        newWordsInserted: result.newWordsInserted,
        totalWordsInChapter: result.totalWordsInChapter,
        dialogueLinesCount: result.dialogueLinesCount,
        wordsExtracted: result.wordsExtracted
      },
      'Image processed successfully'
    )

    return successResponse(response)
  } catch (error) {
    logger.error({ seriesSlug, chapterNumber, error }, 'Pipeline error')
    throw new ExternalServiceError(
      'OCR/Translation pipeline',
      error instanceof Error ? error.message : 'Pipeline processing failed'
    )
  }
}

export const POST = withErrorHandler(handler)
