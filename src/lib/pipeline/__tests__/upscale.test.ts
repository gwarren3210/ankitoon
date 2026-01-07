import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import sharp from 'sharp'
import { upscaleImage } from '@/lib/pipeline/upscale'

describe('upscale', () => {
  let originalEnv: string | undefined

  beforeEach(() => {
    originalEnv = process.env.ENABLE_UPSCALE
    delete process.env.ENABLE_UPSCALE
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ENABLE_UPSCALE = originalEnv
    } else {
      delete process.env.ENABLE_UPSCALE
    }
  })

  describe('upscaleImage', () => {
    it('returns original buffer when upscaling disabled', async () => {
      const imageBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const result = await upscaleImage(imageBuffer, { enabled: false })

      expect(result).toBe(imageBuffer)
    })

    it('upscales image by configured scale factor (default 2.0)', async () => {
      const imageBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const result = await upscaleImage(imageBuffer, { enabled: true })

      const metadata = await sharp(result).metadata()
      expect(metadata.width).toBe(200)
      expect(metadata.height).toBe(200)
    })

    it('converts output to PNG format', async () => {
      const jpegBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .jpeg()
        .toBuffer()

      const result = await upscaleImage(jpegBuffer, { enabled: true })

      const metadata = await sharp(result).metadata()
      expect(metadata.format).toBe('png')
    })

    it('calculates correct dimensions (width * scale, height * scale)', async () => {
      const imageBuffer = await sharp({
        create: {
          width: 150,
          height: 200,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const result = await upscaleImage(imageBuffer, {
        enabled: true,
        scale: 2.0
      })

      const metadata = await sharp(result).metadata()
      expect(metadata.width).toBe(300)
      expect(metadata.height).toBe(400)
    })

    it('handles non-integer scale factors', async () => {
      const imageBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const result = await upscaleImage(imageBuffer, {
        enabled: true,
        scale: 1.5
      })

      const metadata = await sharp(result).metadata()
      expect(metadata.width).toBe(150)
      expect(metadata.height).toBe(150)
    })

    it('returns original buffer on upscale failure (graceful degradation)', async () => {
      const invalidBuffer = Buffer.from('not an image')
      const result = await upscaleImage(invalidBuffer, { enabled: true })

      expect(result).toBe(invalidBuffer)
    })

    it('respects enabled config flag', async () => {
      const imageBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const resultEnabled = await upscaleImage(imageBuffer, { enabled: true })
      const resultDisabled = await upscaleImage(imageBuffer, { enabled: false })

      const metadataEnabled = await sharp(resultEnabled).metadata()
      const metadataDisabled = await sharp(resultDisabled).metadata()

      expect(metadataEnabled.width).toBe(200)
      expect(metadataDisabled.width).toBe(100)
    })

    it('respects scale config flag', async () => {
      const imageBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const result = await upscaleImage(imageBuffer, {
        enabled: true,
        scale: 3.0
      })

      const metadata = await sharp(result).metadata()
      expect(metadata.width).toBe(300)
      expect(metadata.height).toBe(300)
    })

    it('uses lanczos3 kernel for quality', async () => {
      const imageBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const result = await upscaleImage(imageBuffer, { enabled: true })

      const metadata = await sharp(result).metadata()
      expect(metadata.width).toBe(200)
      expect(metadata.height).toBe(200)
      expect(metadata.format).toBe('png')
    })

    it('verifies upscaled buffer is valid image', async () => {
      const imageBuffer = await sharp({
        create: {
          width: 50,
          height: 50,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const result = await upscaleImage(imageBuffer, { enabled: true })

      const metadata = await sharp(result).metadata()
      expect(metadata.format).toBe('png')
      expect(metadata.width).toBe(100)
      expect(metadata.height).toBe(100)
      expect(result.length).toBeGreaterThan(0)
    })

    it('handles edge cases (very small images)', async () => {
      const imageBuffer = await sharp({
        create: {
          width: 1,
          height: 1,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const result = await upscaleImage(imageBuffer, { enabled: true })

      const metadata = await sharp(result).metadata()
      expect(metadata.width).toBe(2)
      expect(metadata.height).toBe(2)
    })

    it('handles edge cases (very large images)', async () => {
      const imageBuffer = await sharp({
        create: {
          width: 2000,
          height: 2000,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const result = await upscaleImage(imageBuffer, {
        enabled: true,
        scale: 1.5
      })

      const metadata = await sharp(result).metadata()
      expect(metadata.width).toBe(3000)
      expect(metadata.height).toBe(3000)
    })

    it('uses ENABLE_UPSCALE env var when config not provided', async () => {
      process.env.ENABLE_UPSCALE = '1'
      const imageBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const result = await upscaleImage(imageBuffer)

      const metadata = await sharp(result).metadata()
      expect(metadata.width).toBe(200)
      expect(metadata.height).toBe(200)
    })

    it('respects ENABLE_UPSCALE=false env var', async () => {
      process.env.ENABLE_UPSCALE = 'false'
      const imageBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const result = await upscaleImage(imageBuffer)

      expect(result).toBe(imageBuffer)
    })
  })
})

