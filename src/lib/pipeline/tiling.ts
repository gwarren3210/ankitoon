import sharp from 'sharp'
import {
  TilingConfig,
  TileInfo,
  OcrResult,
  OcrResultWithContext,
  BoundingBox
} from '@/lib/pipeline/types'

const DEFAULT_CONFIG: TilingConfig = {
  fileSizeThreshold: 1 * 1024 * 1024, // 1MB
  overlapPercentage: 0.10 // 10%
}

/**
 * Creates adaptive tiles from an image buffer based on file size.
 * Splits large images into overlapping tiles for OCR processing.
 * Input: image buffer and optional config
 * Output: array of tile buffers with position metadata
 */
export async function createAdaptiveTiles(
  imageBuffer: Buffer,
  config: Partial<TilingConfig> = {}
): Promise<TileInfo[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const image = sharp(imageBuffer)
  const metadata = await image.metadata()

  const imgWidth = metadata.width!
  const imgHeight = metadata.height!
  const fileSize = imageBuffer.length

  // Small images don't need tiling
  if (fileSize < cfg.fileSizeThreshold) {
    return [{
      buffer: imageBuffer,
      startY: 0,
      width: imgWidth,
      height: imgHeight
    }]
  }

  // Calculate tile height based on how much we exceed threshold
  const excessRatio = fileSize / cfg.fileSizeThreshold
  const baseDivisions = Math.ceil(excessRatio)
  const tileHeight = Math.floor(imgHeight / baseDivisions)

  const tiles: TileInfo[] = []
  let startY = 0

  while (startY < imgHeight) {
    const endY = Math.min(startY + tileHeight, imgHeight)
    const actualTileHeight = endY - startY

    const tileBuffer = await image
      .clone()
      .extract({
        left: 0,
        top: startY,
        width: imgWidth,
        height: actualTileHeight
      })
      .jpeg({ quality: 85 })
      .toBuffer()

    tiles.push({
      buffer: tileBuffer,
      startY,
      width: imgWidth,
      height: actualTileHeight
    })

    startY += tileHeight
  }

  return tiles
}

/**
 * Adjusts tile-relative OCR results to absolute image coordinates.
 * Input: OCR results from a tile and tile metadata
 * Output: OCR results with absolute coordinates and tile context
 */
export function adjustCoordinates(
  results: OcrResult[],
  tile: TileInfo
): OcrResultWithContext[] {
  const tileContext: BoundingBox = {
    x: 0,
    y: tile.startY,
    width: tile.width,
    height: tile.height
  }

  return results.map(result => ({
    ...result,
    bbox: {
      x: result.bbox.x,
      y: result.bbox.y + tile.startY,
      width: result.bbox.width,
      height: result.bbox.height
    },
    tileContext
  }))
}

/**
 * Filters duplicate OCR results from overlapping tile regions.
 * Keeps the result furthest from tile edges (most reliable).
 * Input: array of OCR results with tile context
 * Output: deduplicated OCR results
 */
export function filterDuplicates(
  data: OcrResultWithContext[]
): OcrResult[] {
  const positionMap = new Map<string, {
    entry: OcrResultWithContext
    distance: number
  }>()

  for (const entry of data) {
    const key = `${entry.bbox.x},${entry.bbox.y}`

    // Calculate distance from Y edges (where duplicates occur)
    const distanceFromTop = entry.bbox.y - entry.tileContext.y
    const distanceFromBottom =
      (entry.tileContext.y + entry.tileContext.height) -
      (entry.bbox.y + entry.bbox.height)
    const distanceFromEdge = Math.min(distanceFromTop, distanceFromBottom)

    const existing = positionMap.get(key)
    if (!existing || distanceFromEdge > existing.distance) {
      positionMap.set(key, { entry, distance: distanceFromEdge })
    }
  }

  return Array.from(positionMap.values()).map(({ entry }) => ({
    text: entry.text,
    bbox: entry.bbox
  }))
}

/**
 * Checks if an image needs tiling based on file size.
 * Input: image buffer and threshold
 * Output: boolean
 */
export function needsTiling(
  imageBuffer: Buffer,
  threshold: number = DEFAULT_CONFIG.fileSizeThreshold
): boolean {
  return imageBuffer.length > threshold
}

