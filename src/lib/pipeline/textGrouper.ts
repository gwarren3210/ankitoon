import { OcrResult, BoundingBox, OcrLineResult } from '@/lib/pipeline/types'
import { saveDebugJson, isDebugEnabled } from '@/lib/pipeline/debugArtifacts'
import { logger } from '@/lib/pipeline/logger'

/**
 * Groups OCR results into speech bubbles by vertical proximity.
 * Input: OCR results array, vertical threshold in pixels
 * Output: array of line results with combined text and bounding boxes
 */
export async function groupOcrIntoLines(
  ocrResults: OcrResult[],
  verticalThreshold: number = 100
): Promise<OcrLineResult[]> {
  logger.debug({
    resultCount: ocrResults.length,
    verticalThreshold
  }, 'Grouping OCR results into lines')

  if (ocrResults.length === 0) {
    logger.debug('No OCR results to group')
    return []
  }

  const sorted = sortByVerticalPosition(ocrResults)
  const groups = groupByProximity(sorted, verticalThreshold)
  logger.debug({ groupCount: groups.length }, 'Grouped OCR results by proximity')

  const result = groups.map(group => ({
    line: combineGroupText(group),
    bbox: combineBoundingBoxes(group.map(r => r.bbox))
  }))

  if (isDebugEnabled()) {
    await saveDebugJson('dialogue-grouped', result)
  }
  logger.info({ lineCount: result.length }, 'OCR results grouped into lines')
  return result
}

/**
 * Sorts OCR results by y-coordinate ascending.
 * Input: OCR results array
 * Output: sorted copy of array
 */
function sortByVerticalPosition(ocrData: OcrResult[]): OcrResult[] {
  return [...ocrData].sort((a, b) => a.bbox.y - b.bbox.y)
}

/**
 * Groups sorted OCR results by vertical distance threshold.
 * Input: sorted OCR results, threshold in pixels
 * Output: array of grouped OCR results
 */
function groupByProximity(
  sorted: OcrResult[],
  threshold: number
): OcrResult[][] {
  const groups: OcrResult[][] = []
  let current: OcrResult[] = []

  for (const item of sorted) {
    const last = current[current.length - 1]
    if (!last || Math.abs(item.bbox.y - last.bbox.y) <= threshold) {
      current.push(item)
    } else {
      groups.push(current)
      current = [item]
    }
  }

  if (current.length > 0) {
    groups.push(current)
  }

  return groups
}

/**
 * Combines text from a group, sorting by reading order (top-to-bottom, left-to-right).
 * Uses median text height for vertical tolerance when determining same-line elements.
 * Input: group of OCR results
 * Output: combined text string
 */
function combineGroupText(group: OcrResult[]): string {
  if (group.length === 0) return ''

  const medianHeight = calculateMedianHeight(group)
  const yTolerance = medianHeight * 0.2

  const sorted = [...group].sort((a, b) => {
    if (Math.abs(a.bbox.y - b.bbox.y) <= yTolerance) {
      return a.bbox.x - b.bbox.x
    }
    return a.bbox.y - b.bbox.y
  })

  return sorted.map(r => r.text).join(' ')
}

/**
 * Calculates median height of text elements in a group.
 * Input: group of OCR results
 * Output: median height value
 */
function calculateMedianHeight(group: OcrResult[]): number {
  const heights = group.map(r => r.bbox.height).sort((a, b) => a - b)
  const mid = Math.floor(heights.length / 2)

  if (heights.length % 2 === 0) {
    return (heights[mid - 1] + heights[mid]) / 2
  }
  return heights[mid]
}

/**
 * Creates a bounding box encompassing all input boxes.
 * Input: array of bounding boxes
 * Output: combined bounding box
 */
function combineBoundingBoxes(boxes: BoundingBox[]): BoundingBox {
  const minX = Math.min(...boxes.map(b => b.x))
  const minY = Math.min(...boxes.map(b => b.y))
  const maxX = Math.max(...boxes.map(b => b.x + b.width))
  const maxY = Math.max(...boxes.map(b => b.y + b.height))

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

