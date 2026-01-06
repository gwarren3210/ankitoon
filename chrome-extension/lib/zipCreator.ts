import JSZip from 'jszip'
import type { ScrapedImage } from '../types/extension'

/**
 * Creates a zip file from scraped images, maintaining order
 * @param images - Array of scraped images with URLs
 * @returns Promise resolving to zip blob
 */
export async function createZipFromImages(
  images: ScrapedImage[]
): Promise<Blob> {
  const zip = new JSZip()
  const totalImages = images.length
  const paddingLength = totalImages.toString().length

  for (let i = 0; i < images.length; i++) {
    try {
      const response = await fetch(images[i].url)
      if (!response.ok) {
        throw new Error(`Failed to fetch image ${i + 1}: ${response.statusText}`)
      }
      const blob = await response.blob()
      const extension = getFileExtension(images[i].url, blob.type)
      const paddedIndex = String(i + 1).padStart(paddingLength, '0')
      const filename = `${paddedIndex}-${images[i].name}${extension}`
      zip.file(filename, blob)
    } catch (error) {
      console.error(`Error fetching image ${i + 1}:`, error)
      throw error
    }
  }

  return await zip.generateAsync({ type: 'blob' })
}

/**
 * Gets file extension from URL or blob type
 * @param url - Image URL
 * @param mimeType - Blob MIME type
 * @returns File extension with dot prefix
 */
function getFileExtension(url: string, mimeType: string): string {
  const urlMatch = url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i)
  if (urlMatch) {
    return `.${urlMatch[1].toLowerCase()}`
  }

  const mimeMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
  }

  return mimeMap[mimeType] || '.jpg'
}

