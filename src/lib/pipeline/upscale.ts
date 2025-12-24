import sharp from 'sharp'
import { logger } from '@/lib/pipeline/logger'
import { UpscaleConfig } from '@/lib/pipeline/types'

const DEFAULT_SCALE = 2.0

/**
 * Upscales an image buffer using high-quality resampling.
 * Currently uses sharp's lanczos3 algorithm for quality upscaling.
 * Can be replaced with waifu2x implementation if needed.
 * Input: image buffer and optional config
 * Output: upscaled image buffer
 */
export async function upscaleImage(
  imageBuffer: Buffer,
  config: UpscaleConfig = {}
): Promise<Buffer> {
  const enabled = config.enabled ?? 
    (process.env.ENABLE_UPSCALE === '1' || 
     process.env.ENABLE_UPSCALE === 'true')
  
  if (!enabled) {
    logger.debug('Upscaling disabled, returning original image')
    return imageBuffer
  }

  const scale = config.scale ?? DEFAULT_SCALE
  logger.debug({ scale }, 'Starting image upscaling')

  try {
    const image = sharp(imageBuffer)
    const metadata = await image.metadata()
    
    const originalWidth = metadata.width!
    const originalHeight = metadata.height!
    const originalFormat = metadata.format
    const newWidth = Math.round(originalWidth * scale)
    const newHeight = Math.round(originalHeight * scale)

    logger.debug({
      originalWidth,
      originalHeight,
      originalFormat,
      newWidth,
      newHeight,
      scale
    }, 'Upscaling image dimensions, converting to PNG')

    const upscaledBuffer = await image
      .resize(newWidth, newHeight, {
        kernel: sharp.kernel.lanczos3,
        fit: 'fill'
      })
      .png()
      .toBuffer()

    logger.info({
      originalSize: imageBuffer.length,
      upscaledSize: upscaledBuffer.length,
      scale
    }, 'Image upscaling completed')

    return upscaledBuffer
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error)
    }, 'Image upscaling failed, returning original')
    return imageBuffer
  }
}

