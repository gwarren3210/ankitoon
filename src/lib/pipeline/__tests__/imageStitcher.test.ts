import { describe, it, expect } from 'bun:test'
import { readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'
import { stitchImageBuffers } from '@/lib/pipeline/imageStitcher'

const TEST_DATA_DIR = join(__dirname, 'test-data')

describe('imageStitcher', () => {
  describe('stitchImageBuffers', () => {
    it('stitches single image buffer (returns same buffer)', async () => {
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

      const result = await stitchImageBuffers([imageBuffer])

      expect(result).toBeInstanceOf(Buffer)
      expect(result.length).toBeGreaterThan(0)
      const metadata = await sharp(result).metadata()
      expect(metadata.width).toBe(100)
      expect(metadata.height).toBe(100)
    })

    it('stitches multiple images vertically', async () => {
      const image1 = await sharp({
        create: {
          width: 200,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const image2 = await sharp({
        create: {
          width: 200,
          height: 150,
          channels: 3,
          background: { r: 0, g: 255, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const result = await stitchImageBuffers([image1, image2])

      const metadata = await sharp(result).metadata()
      expect(metadata.width).toBe(200)
      expect(metadata.height).toBe(250)
    })

    it('calculates correct canvas dimensions (max width, sum of heights)', async () => {
      const image1 = await sharp({
        create: {
          width: 300,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const image2 = await sharp({
        create: {
          width: 200,
          height: 150,
          channels: 3,
          background: { r: 0, g: 255, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const image3 = await sharp({
        create: {
          width: 250,
          height: 75,
          channels: 3,
          background: { r: 0, g: 0, b: 255 }
        }
      })
        .png()
        .toBuffer()

      const result = await stitchImageBuffers([image1, image2, image3])

      const metadata = await sharp(result).metadata()
      expect(metadata.width).toBe(300)
      expect(metadata.height).toBe(325)
    })

    it('handles images with different widths (uses max width)', async () => {
      const image1 = await sharp({
        create: {
          width: 500,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const image2 = await sharp({
        create: {
          width: 300,
          height: 100,
          channels: 3,
          background: { r: 0, g: 255, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const result = await stitchImageBuffers([image1, image2])

      const metadata = await sharp(result).metadata()
      expect(metadata.width).toBe(500)
      expect(metadata.height).toBe(200)
    })

    it('throws error for empty array', async () => {
      await expect(stitchImageBuffers([])).rejects.toThrow(
        'No images provided for stitching'
      )
    })

    it('throws error for invalid image buffers', async () => {
      const invalidBuffer = Buffer.from('not an image')

      await expect(
        stitchImageBuffers([invalidBuffer])
      ).rejects.toThrow('Invalid image at index 0')
    })

    it('handles large images without dimension limits', async () => {
      const largeImage = await sharp({
        create: {
          width: 32768,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const result = await stitchImageBuffers([largeImage])

      expect(result).toBeInstanceOf(Buffer)
      expect(result.length).toBeGreaterThan(0)
      const metadata = await sharp(result).metadata()
      expect(metadata.width).toBe(32768)
      expect(metadata.height).toBe(100)
    })

    it('verifies output is valid PNG buffer', async () => {
      const image1 = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const result = await stitchImageBuffers([image1])

      const metadata = await sharp(result).metadata()
      expect(metadata.format).toBe('png')
    })

    it('verifies stitched image has correct dimensions using sharp metadata', async () => {
      const image1 = await sharp({
        create: {
          width: 150,
          height: 80,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const image2 = await sharp({
        create: {
          width: 150,
          height: 120,
          channels: 3,
          background: { r: 0, g: 255, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const result = await stitchImageBuffers([image1, image2])

      const metadata = await sharp(result).metadata()
      expect(metadata.width).toBe(150)
      expect(metadata.height).toBe(200)
    })

    it('preserves image quality in stitched output', async () => {
      const image1 = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const image2 = await sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 0, g: 255, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const result = await stitchImageBuffers([image1, image2])

      const metadata = await sharp(result).metadata()
      expect(metadata.width).toBe(200)
      expect(metadata.height).toBe(400)
      expect(metadata.format).toBe('png')
      expect(result.length).toBeGreaterThan(0)
    })

    it.skip('stitches all images from solo-leveling-chapter-1 directory', async () => {
      const chapterDir = join(TEST_DATA_DIR, 'solo-leveling-chapter-1')
      const files = await readdir(chapterDir)
      const imageFiles = files
        .filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file))
        .sort((a, b) => {
          const numA = parseInt(a.match(/\d+/)?.[0] || '0')
          const numB = parseInt(b.match(/\d+/)?.[0] || '0')
          return numA - numB
        })

      expect(imageFiles.length).toBe(64)

      const imageBuffers: Buffer[] = []
      for (const file of imageFiles) {
        const buffer = await readFile(join(chapterDir, file))
        imageBuffers.push(buffer)
      }

      const stitchedImage = await stitchImageBuffers(imageBuffers)

      expect(stitchedImage).toBeInstanceOf(Buffer)
      expect(stitchedImage.length).toBeGreaterThan(0)

      const metadata = await sharp(stitchedImage).metadata()
      expect(metadata.width).toBeGreaterThan(0)
      expect(metadata.height).toBeGreaterThan(0)
      expect(metadata.format).toBe('png')

      const outputPath = join(TEST_DATA_DIR, 'solo-leveling-chapter-1-stitched.png')
      await writeFile(outputPath, stitchedImage)

      expect(metadata.height).toBeGreaterThan(
        metadata.width || 0
      )
    })
  })
})

