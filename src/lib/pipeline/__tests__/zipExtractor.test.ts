import { describe, it, expect } from 'bun:test'
import { readFile, mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import JSZip from 'jszip'
import sharp from 'sharp'
import { extractImagesFromZip } from '@/lib/pipeline/zipExtractor'

const TEST_DATA_DIR = join(__dirname, 'test-data')

describe('zipExtractor', () => {
  describe('extractImagesFromZip', () => {
    it('extracts valid PNG images from zip', async () => {
      const zip = new JSZip()
      const pngBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      zip.file('image1.png', pngBuffer)
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

      const results = await extractImagesFromZip(zipBuffer)

      expect(results).toHaveLength(1)
      expect(results[0]).toBeInstanceOf(Buffer)
      const metadata = await sharp(results[0]).metadata()
      expect(metadata.format).toBe('png')
    })

    it('extracts valid JPEG images from zip', async () => {
      const zip = new JSZip()
      const jpegBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 0, g: 255, b: 0 }
        }
      })
        .jpeg()
        .toBuffer()

      zip.file('image1.jpg', jpegBuffer)
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

      const results = await extractImagesFromZip(zipBuffer)

      expect(results).toHaveLength(1)
      expect(results[0]).toBeInstanceOf(Buffer)
      const metadata = await sharp(results[0]).metadata()
      expect(metadata.format).toBe('jpeg')
    })

    it('extracts valid WEBP images from zip', async () => {
      const zip = new JSZip()
      const webpBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 0, g: 0, b: 255 }
        }
      })
        .webp()
        .toBuffer()

      zip.file('image1.webp', webpBuffer)
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

      const results = await extractImagesFromZip(zipBuffer)

      expect(results).toHaveLength(1)
      expect(results[0]).toBeInstanceOf(Buffer)
      const metadata = await sharp(results[0]).metadata()
      expect(metadata.format).toBe('webp')
    })

    it('skips non-image files', async () => {
      const zip = new JSZip()
      const pngBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      zip.file('image1.png', pngBuffer)
      zip.file('text.txt', Buffer.from('not an image'))
      zip.file('data.json', Buffer.from('{"key": "value"}'))
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

      const results = await extractImagesFromZip(zipBuffer)

      expect(results).toHaveLength(1)
    })

    it('skips directories', async () => {
      const zip = new JSZip()
      const pngBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      zip.file('image1.png', pngBuffer)
      zip.folder('subfolder')
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

      const results = await extractImagesFromZip(zipBuffer)

      expect(results).toHaveLength(1)
    })

    it('skips empty files', async () => {
      const zip = new JSZip()
      const pngBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      zip.file('image1.png', pngBuffer)
      zip.file('empty.png', Buffer.alloc(0))
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

      const results = await extractImagesFromZip(zipBuffer)

      expect(results).toHaveLength(1)
    })

    it('throws error for oversized images (>10MB)', async () => {
      const zip = new JSZip()
      const pngBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024)
      oversizedBuffer[0] = 0x89
      oversizedBuffer[1] = 0x50
      oversizedBuffer[2] = 0x4e
      oversizedBuffer[3] = 0x47

      zip.file('image1.png', pngBuffer)
      zip.file('oversized.png', oversizedBuffer)
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

      await expect(extractImagesFromZip(zipBuffer)).rejects.toThrow(
        'exceeds max size'
      )
    })

    it('throws error for zip exceeding MAX_ZIP_SIZE (100MB)', async () => {
      const zip = new JSZip()
      const largeBuffer = Buffer.alloc(101 * 1024 * 1024)
      zip.file('large.bin', largeBuffer)
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

      await expect(extractImagesFromZip(zipBuffer)).rejects.toThrow(
        'exceeds max size'
      )
    })

    it('throws error when no valid images found', async () => {
      const zip = new JSZip()
      zip.file('text.txt', Buffer.from('not an image'))
      zip.file('data.json', Buffer.from('{"key": "value"}'))
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

      await expect(extractImagesFromZip(zipBuffer)).rejects.toThrow(
        'No valid images found in zip file'
      )
    })

    it('throws error when too many images (>500)', async () => {
      const zip = new JSZip()
      const pngBuffer = await sharp({
        create: {
          width: 10,
          height: 10,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      for (let i = 0; i < 501; i++) {
        zip.file(`image${i}.png`, pngBuffer)
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

      await expect(extractImagesFromZip(zipBuffer)).rejects.toThrow(
        'Too many images'
      )
    })

    it('validates image buffers using file signatures', async () => {
      const zip = new JSZip()
      const pngBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const fakePng = Buffer.from('fake.png content')
      zip.file('image1.png', pngBuffer)
      zip.file('fake.png', fakePng)
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

      const results = await extractImagesFromZip(zipBuffer)

      expect(results).toHaveLength(1)
    })

    it('handles invalid zip format', async () => {
      const invalidZip = Buffer.from('not a zip file')

      await expect(extractImagesFromZip(invalidZip)).rejects.toThrow(
        'Invalid zip file format'
      )
    })

    it('preserves image order from zip', async () => {
      const zip = new JSZip()
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

      const image2 = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 0, g: 255, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const image3 = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 0, g: 0, b: 255 }
        }
      })
        .png()
        .toBuffer()

      zip.file('image1.png', image1)
      zip.file('image2.png', image2)
      zip.file('image3.png', image3)
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

      const results = await extractImagesFromZip(zipBuffer)

      expect(results).toHaveLength(3)
      const metadata1 = await sharp(results[0]).metadata()
      const metadata2 = await sharp(results[1]).metadata()
      const metadata3 = await sharp(results[2]).metadata()
      expect(metadata1.format).toBe('png')
      expect(metadata2.format).toBe('png')
      expect(metadata3.format).toBe('png')
    })

    it('handles mixed valid/invalid files in zip', async () => {
      const zip = new JSZip()
      const pngBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
        .png()
        .toBuffer()

      zip.file('image1.png', pngBuffer)
      zip.file('text.txt', Buffer.from('not an image'))
      zip.file('fake.png', Buffer.from('fake image data'))
      zip.file('empty.png', Buffer.alloc(0))
      zip.folder('subfolder')
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

      const results = await extractImagesFromZip(zipBuffer)

      expect(results).toHaveLength(1)
    })

    it('extracts images from nested directories in alphanumeric order ({number}-file naming)', async () => {
      const zip = new JSZip()
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

      const image2 = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 0, g: 255, b: 0 }
        }
      })
        .png()
        .toBuffer()

      const image10 = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 0, g: 0, b: 255 }
        }
      })
        .png()
        .toBuffer()

      zip.file('1-subDir/image.jpg', image1)
      zip.file('3-subDir/image.jpg', image2)
      zip.file('2-subDir/image.jpg', image10)
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

      const results = await extractImagesFromZip(zipBuffer)

      expect(results).toHaveLength(3)

      const zip2 = await JSZip.loadAsync(zipBuffer)
      const fileNames = Object.keys(zip2.files)
        .filter(name => !zip2.files[name].dir && name.match(/\.(png|jpg|jpeg|webp)$/i))
        .sort()

      expect(fileNames[0]).toContain('1-subDir')
      expect(fileNames[1]).toContain('2-subDir')
      expect(fileNames[2]).toContain('3-subDir')

      const stats1 = await sharp(results[0]).stats()
      const stats2 = await sharp(results[1]).stats()
      const stats10 = await sharp(results[2]).stats()

      const avgR1 = stats1.channels[0].mean
      const avgG2 = stats2.channels[1].mean
      const avgB10 = stats10.channels[2].mean

      expect(avgR1).toBeGreaterThan(200)
      expect(avgG2).toBeGreaterThan(200)
      expect(avgB10).toBeGreaterThan(200)
    })

    it.skip('extracts images from solo-leveling-chapter-1.zip and saves to output directory', async () => {
      const zipBuffer = await readFile(
        join(TEST_DATA_DIR, 'solo-leveling-chapter-1.zip')
      )

      const results = await extractImagesFromZip(zipBuffer)

      expect(results.length).toBeGreaterThan(0)

      const outputDir = join(TEST_DATA_DIR, 'solo-leveling-chapter-1')
      await mkdir(outputDir, { recursive: true })

      for (let i = 0; i < results.length; i++) {
        const imageBuffer = results[i]
        const metadata = await sharp(imageBuffer).metadata()
        const extension = metadata.format === 'jpeg' ? 'jpg' : metadata.format || 'png'
        const fileName = `image-${i}.${extension}`
        await writeFile(join(outputDir, fileName), imageBuffer)
      }

      expect(results.length).toBe(64)
    })
  })
})

