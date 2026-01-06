import { ImageFile, StitchResult } from '../types/extension'

const MAX_CANVAS_DIMENSION = 32767
const MAX_CANVAS_AREA = 268435456

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`))
    img.src = URL.createObjectURL(file)
  })
}

function getMaxWidth(images: HTMLImageElement[]): number {
  return Math.max(...images.map((img) => img.width), 0)
}

function getTotalHeight(images: HTMLImageElement[]): number {
  return images.reduce((sum, img) => sum + img.height, 0)
}

function validateCanvasDimensions(
  width: number,
  height: number
): void {
  if (width > MAX_CANVAS_DIMENSION || height > MAX_CANVAS_DIMENSION) {
    throw new Error(
      `Canvas dimensions (${width}x${height}) exceed browser limit of ${MAX_CANVAS_DIMENSION}px`
    )
  }
  if (width * height > MAX_CANVAS_AREA) {
    throw new Error(
      `Canvas area (${width * height}) exceeds browser limit of ${MAX_CANVAS_AREA} pixels`
    )
  }
}

function calculateScaleFactor(
  width: number,
  height: number
): number {
  const widthScale = MAX_CANVAS_DIMENSION / width
  const heightScale = MAX_CANVAS_DIMENSION / height
  return Math.min(widthScale, heightScale, 1.0)
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
    img.src = url
  })
}

export async function stitchImages(
  imageFiles: ImageFile[]
): Promise<StitchResult> {
  if (imageFiles.length === 0) {
    throw new Error('No images provided')
  }

  const images: HTMLImageElement[] = []
  const objectUrls: string[] = []

  try {
    for (const imageFile of imageFiles) {
      const img = await loadImage(imageFile.file)
      images.push(img)
      objectUrls.push(img.src)
    }

    const maxWidth = getMaxWidth(images)
    const totalHeight = getTotalHeight(images)

    if (maxWidth === 0 || totalHeight === 0) {
      throw new Error('Invalid image dimensions')
    }

    const scaleFactor = calculateScaleFactor(maxWidth, totalHeight)
    const scaledWidth = Math.floor(maxWidth * scaleFactor)
    const scaledHeight = Math.floor(totalHeight * scaleFactor)

    validateCanvasDimensions(scaledWidth, scaledHeight)

    const canvas = document.createElement('canvas')
    canvas.width = scaledWidth
    canvas.height = scaledHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: false })

    if (!ctx) {
      throw new Error('Failed to get canvas context')
    }

    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, scaledWidth, scaledHeight)

    let currentY = 0
    for (const img of images) {
      const scaledImgHeight = Math.floor(img.height * scaleFactor)
      ctx.drawImage(img, 0, currentY, scaledWidth, scaledImgHeight)
      currentY += scaledImgHeight
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(
              new Error(
                `Failed to create blob from canvas (${scaledWidth}x${scaledHeight})`
              )
            )
          }
        },
        'image/png',
        1.0
      )
    })

    return {
      blob,
      width: scaledWidth,
      height: scaledHeight,
      imageCount: images.length,
    }
  } finally {
    objectUrls.forEach((url) => URL.revokeObjectURL(url))
  }
}

export async function stitchImagesFromUrls(
  imageUrls: string[]
): Promise<StitchResult> {
  if (imageUrls.length === 0) {
    throw new Error('No images provided')
  }

  const images: HTMLImageElement[] = []

  try {
    for (const url of imageUrls) {
      const img = await loadImageFromUrl(url)
      images.push(img)
    }

    const maxWidth = getMaxWidth(images)
    const totalHeight = getTotalHeight(images)

    if (maxWidth === 0 || totalHeight === 0) {
      throw new Error('Invalid image dimensions')
    }

    const scaleFactor = calculateScaleFactor(maxWidth, totalHeight)
    const scaledWidth = Math.floor(maxWidth * scaleFactor)
    const scaledHeight = Math.floor(totalHeight * scaleFactor)

    validateCanvasDimensions(scaledWidth, scaledHeight)

    const canvas = document.createElement('canvas')
    canvas.width = scaledWidth
    canvas.height = scaledHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: false })

    if (!ctx) {
      throw new Error('Failed to get canvas context')
    }

    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, scaledWidth, scaledHeight)

    let currentY = 0
    for (const img of images) {
      const scaledImgHeight = Math.floor(img.height * scaleFactor)
      ctx.drawImage(img, 0, currentY, scaledWidth, scaledImgHeight)
      currentY += scaledImgHeight
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(
              new Error(
                `Failed to create blob from canvas (${scaledWidth}x${scaledHeight})`
              )
            )
          }
        },
        'image/png',
        1.0
      )
    })

    return {
      blob,
      width: scaledWidth,
      height: scaledHeight,
      imageCount: images.length,
    }
  } catch (error) {
    throw error
  }
}

