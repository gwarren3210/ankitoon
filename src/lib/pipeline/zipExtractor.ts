import JSZip from 'jszip'
import { logger } from '@/lib/logger'

const MAX_ZIP_SIZE = 100 * 1024 * 1024
const MAX_IMAGES_PER_ZIP = 500
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp']

/**
 * Extracts and validates images from zip file buffer.
 * Input: zip file buffer
 * Output: array of image buffers
 */
export async function extractImagesFromZip(
  zipBuffer: Buffer
): Promise<Buffer[]> {
  if (zipBuffer.length > MAX_ZIP_SIZE) {
    throw new Error(
      `Zip file size (${zipBuffer.length}) exceeds max size (${MAX_ZIP_SIZE})`
    )
  }

  logger.debug({ zipSize: zipBuffer.length }, 'Extracting images from zip')

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(zipBuffer)
  } catch (error) {
    logger.error({ error }, 'Failed to load zip file')
    throw new Error('Invalid zip file format')
  }

  const imageBuffers: Buffer[] = []
  const fileNames = Object.keys(zip.files)

  logger.debug({ fileCount: fileNames.length }, 'Processing zip files')

  for (const fileName of fileNames) {
    const file = zip.files[fileName]

    if (file.dir) {
      continue
    }

    const extension = fileName.toLowerCase().substring(
      fileName.lastIndexOf('.')
    )

    if (!SUPPORTED_EXTENSIONS.includes(extension)) {
      logger.debug({ fileName, extension }, 'Skipping non-image file')
      continue
    }

    try {
      const fileData = await file.async('nodebuffer')
      const fileSize = fileData.length

      if (fileSize === 0) {
        logger.warn({ fileName }, 'Skipping empty file')
        continue
      }

      if (fileSize > MAX_IMAGE_SIZE) {
        logger.error(
          { fileName, fileSize, maxSize: MAX_IMAGE_SIZE },
          'Image exceeds max size'
        )
        throw new Error(
          `Image ${fileName} size (${fileSize}) exceeds max size (${MAX_IMAGE_SIZE})`
        )
      }

      if (!isValidImageBuffer(fileData)) {
        logger.warn({ fileName }, 'Skipping invalid image file')
        continue
      }

      imageBuffers.push(fileData)
      logger.trace(
        { fileName, fileSize, imageCount: imageBuffers.length },
        'Extracted image from zip'
      )
    } catch (error) {
      logger.error({ fileName, error }, 'Failed to extract file from zip')
      throw error
    }
  }

  if (imageBuffers.length === 0) {
    throw new Error('No valid images found in zip file')
  }

  if (imageBuffers.length > MAX_IMAGES_PER_ZIP) {
    throw new Error(
      `Too many images (${imageBuffers.length}) in zip, max is ${MAX_IMAGES_PER_ZIP}`
    )
  }

  logger.info(
    { imageCount: imageBuffers.length, totalFiles: fileNames.length },
    'Successfully extracted images from zip'
  )

  return imageBuffers
}

/**
 * Validates image buffer by checking file signature.
 * Input: buffer
 * Output: true if valid image
 */
function isValidImageBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) {
    return false
  }

  // PNG signature: 89 50 4E 47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return true
  }

  // JPEG signature: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true
  }

  // WEBP signature: RIFF...WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer.length >= 12 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return true
  }

  return false
}

