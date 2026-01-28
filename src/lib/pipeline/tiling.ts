import sharp from 'sharp'
import {
  TilingConfig,
  TileInfo,
  OcrResult,
  OcrResultWithContext,
  BoundingBox
} from '@/lib/pipeline/types'
import { logger } from '@/lib/logger'

const DEFAULT_CONFIG: TilingConfig = {
  fileSizeThreshold: 1 * 1024 * 1024, // 1MB
  overlapPercentage: 0.03
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
  logger.debug({
    fileSizeThreshold: cfg.fileSizeThreshold,
    originalFileSize: imageBuffer.length,
    overlapPercentage: cfg.overlapPercentage
  }, 'Creating adaptive tiles')

  const image = sharp(imageBuffer)
  const metadata = await image.metadata()

  const imgWidth = metadata.width!
  const imgHeight = metadata.height!
  const fileSize = imageBuffer.length
  logger.debug({
    imgWidth,
    imgHeight,
    fileSize,
    needsTiling: fileSize >= cfg.fileSizeThreshold
  }, 'Image metadata extracted')

  // Small images don't need tiling
  if (fileSize < cfg.fileSizeThreshold) {
    logger.debug('Image does not need tiling, returning single tile')
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
  const remainder = imgHeight % baseDivisions
  const overlapHeight = Math.floor(tileHeight * cfg.overlapPercentage)
  logger.debug({
    imgHeight,
    baseDivisions,
    tileHeight,
    remainder,
    overlapHeight
  }, 'Tile calculations completed')

  const tiles: TileInfo[] = []
  let baseStartY = 0

  // Create tiles with overlap
  for (let i = 0; i < baseDivisions && baseStartY < imgHeight; i++) {
    const isFirstTile = i === 0
    const isLastTile = i === baseDivisions - 1
    
    // Calculate actual tile start (with overlap from previous tile, except first)
    const tileStartY = isFirstTile ? 0 : Math.max(0, baseStartY - overlapHeight)
    
    // Calculate base tile height
    const baseTileHeight = tileHeight + (isLastTile ? remainder : 0)
    
    // Calculate tile end (with overlap into next tile, except last)
    let tileEndY = baseStartY + baseTileHeight
    if (!isLastTile) {
      tileEndY = Math.min(tileEndY + overlapHeight, imgHeight)
    } else {
      tileEndY = Math.min(tileEndY, imgHeight)
    }
    
    const actualTileHeight = tileEndY - tileStartY

    logger.trace({
      tileIndex: i,
      tileStartY,
      actualTileHeight,
      isLastTile
    }, 'Creating tile')

    const tileBuffer = await image
      .clone()
      .extract({
        left: 0,
        top: tileStartY,
        width: imgWidth,
        height: actualTileHeight
      })
      .jpeg({ quality: 70 })
      .toBuffer()
    
    // Validate JPEG buffer: check magic bytes and end marker
    const hasValidStart = tileBuffer.length >= 2 && 
      tileBuffer[0] === 0xFF && tileBuffer[1] === 0xD8
    const hasValidEnd = tileBuffer.length >= 2 &&
      tileBuffer[tileBuffer.length - 2] === 0xFF && 
      tileBuffer[tileBuffer.length - 1] === 0xD9
    const isValidJpeg = hasValidStart && hasValidEnd
    
    if (!isValidJpeg) {
      logger.error({
        tileIndex: i,
        tileStartY,
        hasValidStart,
        hasValidEnd
      }, 'Invalid JPEG buffer generated for tile')
      throw new Error(`Invalid JPEG buffer generated for tile at startY=${tileStartY}: start=${hasValidStart}, end=${hasValidEnd}`)
    }

    tiles.push({
      buffer: tileBuffer,
      startY: tileStartY,
      width: imgWidth,
      height: actualTileHeight
    })

    // Move base start position forward by base tile height (not including overlap)
    baseStartY += baseTileHeight
  }

  logger.info({ tileCount: tiles.length }, 'Adaptive tiles created')
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
  logger.debug({
    resultCount: results.length,
    tileStartY: tile.startY,
    tileWidth: tile.width,
    tileHeight: tile.height
  }, 'Adjusting coordinates from tile to absolute')

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
 * Calculate what percentage of box1 is covered by box2.
 * This is useful when box sizes differ - we care if the smaller box
 * is mostly contained within the larger box.
 */
function calculateOverlapPercentage(box1: BoundingBox, box2: BoundingBox): number {
  // Calculate intersection rectangle
  const x1 = Math.max(box1.x, box2.x)
  const y1 = Math.max(box1.y, box2.y)
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width)
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height)
  
  // No intersection
  if (x2 <= x1 || y2 <= y1) {
    return 0
  }
  
  const intersectionArea = (x2 - x1) * (y2 - y1)
  const box1Area = box1.width * box1.height
  
  return intersectionArea / box1Area
}

/**
 * Filters duplicate OCR results from overlapping tile regions.
 * Uses bounding box overlap to identify duplicates - if two boxes
 * overlap significantly, they're considered the same text element.
 * Keeps the result furthest from tile edges (most reliable).
 * Input: array of OCR results with tile context
 * Output: deduplicated OCR results
 */
export function filterDuplicates(
  data: OcrResultWithContext[]
): OcrResult[] {
  logger.debug({ inputCount: data.length }, 'Filtering duplicate OCR results')

  if (data.length === 0) {
    return []
  }

  // Overlap threshold: if boxes overlap this much, they're duplicates
  // Using 0.5 (50%) - generous enough to catch OCR variance but strict enough
  // to avoid false positives. For highly overlapping duplicates from tiling,
  // this will be much higher (70-90%+)
  const OVERLAP_THRESHOLD = 0.5

  const unique: OcrResultWithContext[] = []

  for (const entry of data) {
    // Calculate distance from Y edges (where duplicates occur)
    const distanceFromTop = entry.bbox.y - entry.tileContext.y
    const distanceFromBottom =
      (entry.tileContext.y + entry.tileContext.height) -
      (entry.bbox.y + entry.bbox.height)
    const distanceFromEdge = Math.min(distanceFromTop, distanceFromBottom)

    // Check if this entry overlaps significantly with any existing entry
    const duplicateIndex = unique.findIndex(existing => {
      // Calculate overlap both ways and use the maximum
      // This handles cases where boxes are different sizes
      const overlap1 = calculateOverlapPercentage(entry.bbox, existing.bbox)
      const overlap2 = calculateOverlapPercentage(existing.bbox, entry.bbox)
      const maxOverlap = Math.max(overlap1, overlap2)
      return maxOverlap >= OVERLAP_THRESHOLD
    })

    if (duplicateIndex === -1) {
      // No duplicate found, add as new unique entry
      unique.push(entry)
      logger.trace({
        text: entry.text,
        y: entry.bbox.y,
        distanceFromEdge
      }, 'Added new unique entry')
    } else {
      // Duplicate found, keep the one furthest from tile edges
      const existingDistanceFromTop = unique[duplicateIndex].bbox.y - unique[duplicateIndex].tileContext.y
      const existingDistanceFromBottom =
        (unique[duplicateIndex].tileContext.y + unique[duplicateIndex].tileContext.height) -
        (unique[duplicateIndex].bbox.y + unique[duplicateIndex].bbox.height)
      const existingDistanceFromEdge = Math.min(existingDistanceFromTop, existingDistanceFromBottom)

      const overlap1 = calculateOverlapPercentage(entry.bbox, unique[duplicateIndex].bbox)
      const overlap2 = calculateOverlapPercentage(unique[duplicateIndex].bbox, entry.bbox)
      const maxOverlap = Math.max(overlap1, overlap2)

      if (distanceFromEdge > existingDistanceFromEdge) {
        logger.trace({
          oldText: unique[duplicateIndex].text,
          newText: entry.text,
          overlap: maxOverlap.toFixed(2),
          oldY: unique[duplicateIndex].bbox.y,
          newY: entry.bbox.y,
          oldDistance: existingDistanceFromEdge,
          newDistance: distanceFromEdge
        }, 'Replacing duplicate with better positioned result')
        unique[duplicateIndex] = entry
      } else {
        logger.trace({
          keptText: unique[duplicateIndex].text,
          rejectedText: entry.text,
          overlap: maxOverlap.toFixed(2),
          keptY: unique[duplicateIndex].bbox.y,
          rejectedY: entry.bbox.y
        }, 'Keeping existing result over duplicate')
      }
    }
  }

  const filtered = unique.map(entry => ({
    text: entry.text,
    bbox: entry.bbox
  }))

  logger.debug({
    inputCount: data.length,
    outputCount: filtered.length,
    duplicatesRemoved: data.length - filtered.length
  }, 'Duplicate filtering completed')

  return filtered
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

