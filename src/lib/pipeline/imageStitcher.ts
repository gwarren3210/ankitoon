import sharp from 'sharp'
import { logger } from '@/lib/logger'

/**
 * Stitches image buffers vertically into single buffer.
 * Input: array of image buffers
 * Output: single stitched PNG buffer
 */
export async function stitchImageBuffers(
  imageBuffers: Buffer[]
): Promise<Buffer> {
  if (imageBuffers.length === 0) {
    throw new Error('No images provided for stitching')
  }

  logger.debug({ imageCount: imageBuffers.length }, 'Starting image stitching')

  const imageMetadatas = await Promise.all(
    imageBuffers.map(async (buffer, index) => {
      try {
        const metadata = await sharp(buffer).metadata()
        return {
          index,
          width: metadata.width || 0,
          height: metadata.height || 0,
          buffer
        }
      } catch (error) {
        logger.error({ index, error }, 'Failed to read image metadata')
        throw new Error(`Invalid image at index ${index}`)
      }
    })
  )

  const maxWidth = Math.max(...imageMetadatas.map(img => img.width), 0)
  const totalHeight = imageMetadatas.reduce((sum, img) => sum + img.height, 0)

  if (maxWidth === 0 || totalHeight === 0) {
    throw new Error('Invalid image dimensions')
  }

  logger.debug(
    { maxWidth, totalHeight, imageCount: imageBuffers.length },
    'Calculated stitched dimensions'
  )

  let currentY = 0
  const composite = imageMetadatas.map((img) => {
    const top = currentY
    currentY += img.height
    return {
      input: img.buffer,
      top,
      left: 0
    }
  })

  logger.debug(
    { compositeCount: composite.length },
    'Creating composite image'
  )

  const stitchedBuffer = await sharp({
    create: {
      width: maxWidth,
      height: totalHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite(composite)
    .png()
    .toBuffer()

  logger.info(
    {
      width: maxWidth,
      height: totalHeight,
      bufferSize: stitchedBuffer.length,
      imageCount: imageBuffers.length
    },
    'Image stitching completed'
  )

  return stitchedBuffer
}

