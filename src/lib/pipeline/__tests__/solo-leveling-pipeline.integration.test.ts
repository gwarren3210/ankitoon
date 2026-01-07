import { describe, it, beforeAll, afterEach } from 'bun:test'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { createHash } from 'crypto'
import dotenv from 'dotenv'
import { createAdaptiveTiles } from '@/lib/pipeline/tiling'
import { processImage } from '@/lib/pipeline/ocr'
import { groupOcrIntoLines } from '@/lib/pipeline/textGrouper'
import { OcrConfig, TilesInfo } from '@/lib/pipeline/types'
import { initDebugArtifacts } from '@/lib/pipeline/debugArtifacts'
import { logger } from '@/lib/logger'

dotenv.config({ path: join(process.cwd(), '.env') })

const TEST_DATA_DIR = join(__dirname, 'test-data')
const API_KEY = process.env.OCR_API_KEY || ''
const SKIP_REASON = 'OCR_API_KEY env var not set'

/**
 * Delays execution for rate limiting between API calls.
 * Input: milliseconds
 * Output: promise resolving after delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Saves JSON data to output directory with stage prefix.
 * Input: output dir, stage dir name, filename, data
 * Output: void
 */
async function saveJson(
  outputDir: string,
  stage: string,
  filename: string,
  data: unknown
): Promise<void> {
  const stageDir = join(outputDir, stage)
  await mkdir(stageDir, { recursive: true })
  const filePath = join(stageDir, filename)
  const content = JSON.stringify(data, null, 2)
  await writeFile(filePath, content, 'utf-8')
}

/**
 * Saves buffer to output directory with stage prefix.
 * Input: output dir, stage dir name, filename, buffer
 * Output: void
 */
async function saveBuffer(
  outputDir: string,
  stage: string,
  filename: string,
  buffer: Buffer
): Promise<void> {
  const stageDir = join(outputDir, stage)
  await mkdir(stageDir, { recursive: true })
  const filePath = join(stageDir, filename)
  await writeFile(filePath, buffer)
}

/**
 * Calculates SHA256 hash of a buffer.
 * Input: buffer
 * Output: hex hash string
 */
function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

describe('Solo Leveling Pipeline Integration', () => {
  const skipTests = !API_KEY

  if (skipTests) {
    it.skip(`SKIPPED: ${SKIP_REASON}`, () => {})
    return
  }

  let outputDir: string
  let stitchedImageBuffer: Buffer
  let existingTilesInfo: TilesInfo | null

  beforeAll(async () => {
    await initDebugArtifacts()

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    outputDir = join(TEST_DATA_DIR, `solo-leveling-pipeline-output-${timestamp}`)
    await mkdir(outputDir, { recursive: true })
    console.log(`Test artifacts will be saved to: ${outputDir}`)

    stitchedImageBuffer = await readFile(
      join(TEST_DATA_DIR, 'solo-leveling-chapter-1-stitched.png')
    )

    const existingTilesInfoPath = join(
      TEST_DATA_DIR,
      'solo-leveling-chapter-1-tiles',
      'tiles-info.json'
    )
    try {
      const existingTilesInfoContent = await readFile(existingTilesInfoPath, 'utf-8')
      existingTilesInfo = JSON.parse(existingTilesInfoContent)
    } catch (error) {
      console.warn('Could not load existing tiles-info.json for comparison')
      console.warn(error)
      existingTilesInfo = null
    }
  })

  afterEach(async () => {
    await delay(500)
  })

  it('processes solo-leveling-chapter-1 through full pipeline with comparisons', async () => {
    const differences: string[] = []

    // Step 1: Tiling Comparison
    const tiles = await createAdaptiveTiles(stitchedImageBuffer, {
      fileSizeThreshold: 1 * 1024 * 1024
    })

    const tilesMetadata = tiles.map((t, i) => ({
      index: i,
      startY: t.startY,
      width: t.width,
      height: t.height,
      bufferSize: t.buffer.length
    }))

    await saveJson(outputDir, '01-tiles', 'tiles-info.json', {
      sourceImage: 'solo-leveling-chapter-1-stitched.png',
      tiles: tilesMetadata,
      tileCount: tiles.length
    })

    for (let i = 0; i < tiles.length; i++) {
      await saveBuffer(outputDir, '01-tiles', `tile-${i}.jpg`, tiles[i].buffer)
    }

    if (existingTilesInfo) {
      if (tiles.length !== existingTilesInfo.tileCount) {
        differences.push(
          `Tile count mismatch: expected ${existingTilesInfo.tileCount}, got ${tiles.length}`
        )
      }

      for (let i = 0; i < Math.min(tiles.length, existingTilesInfo.tiles.length); i++) {
        const tile = tiles[i]
        const expected = existingTilesInfo.tiles[i]

        if (tile.startY !== expected.startY) {
          differences.push(
            `Tile ${i} startY mismatch: expected ${expected.startY}, got ${tile.startY}`
          )
        }
        if (tile.width !== expected.width) {
          differences.push(
            `Tile ${i} width mismatch: expected ${expected.width}, got ${tile.width}`
          )
        }
        if (tile.height !== expected.height) {
          differences.push(
            `Tile ${i} height mismatch: expected ${expected.height}, got ${tile.height}`
          )
        }
        if (tile.buffer.length !== expected.bufferSize) {
          differences.push(
            `Tile ${i} bufferSize mismatch: expected ${expected.bufferSize}, got ${tile.buffer.length}`
          )
        }

        const existingTilePath = join(
          TEST_DATA_DIR,
          'solo-leveling-chapter-1-tiles',
          `tile-${i}.jpg`
        )
        try {
          const existingTileBuffer = await readFile(existingTilePath)
          const newHash = hashBuffer(tile.buffer)
          const existingHash = hashBuffer(existingTileBuffer)

          if (newHash !== existingHash) {
            differences.push(`Tile ${i} image hash mismatch`)
          }
        } catch (error) {
          differences.push(`Tile ${i} existing file not found for hash comparison`)
          logger.warn({ error }, `Tile ${i} existing file not found for hash comparison`)
        }
      }
    }

    // Step 2: OCR Processing
    const ocrConfig: OcrConfig = {
      apiKey: API_KEY,
      language: 'kor',
      ocrEngine: 2,
      fileSizeThreshold: 1 * 1024 * 1024,
      scale: true,
      overlapPercentage: 0.10
    }

    const ocrResults = await processImage(stitchedImageBuffer, ocrConfig)

    await saveJson(outputDir, '02-ocr', 'all-ocr-results.json', ocrResults)

    if (!Array.isArray(ocrResults)) {
      differences.push('OCR results is not an array')
    } else {
      if (ocrResults.length === 0) {
        differences.push('OCR returned zero results')
      }

      for (let i = 0; i < ocrResults.length; i++) {
        const result = ocrResults[i]
        if (!result.text || typeof result.text !== 'string') {
          differences.push(`OCR result ${i} missing or invalid text`)
        }
        if (!result.bbox) {
          differences.push(`OCR result ${i} missing bbox`)
        } else {
          if (typeof result.bbox.x !== 'number' || result.bbox.x < 0) {
            differences.push(`OCR result ${i} has invalid bbox.x`)
          }
          if (typeof result.bbox.y !== 'number' || result.bbox.y < 0) {
            differences.push(`OCR result ${i} has invalid bbox.y`)
          }
          if (typeof result.bbox.width !== 'number') {
            differences.push(`OCR result ${i} has invalid bbox.width type`)
          } else if (result.bbox.width <= 0) {
            console.warn(`OCR result ${i} has zero or negative bbox.width (tile may have no text)`)
          }
          if (typeof result.bbox.height !== 'number') {
            differences.push(`OCR result ${i} has invalid bbox.height type`)
          } else if (result.bbox.height <= 0) {
            console.warn(`OCR result ${i} has zero or negative bbox.height (tile may have no text)`)
          }
        }
      }
    }

    // Step 3: Grouping
    const groupedResults = await groupOcrIntoLines(ocrResults)

    await saveJson(outputDir, '03-grouped', 'grouped-results.json', groupedResults)

    // Save dialogue text file
    const dialogueText = groupedResults.map(result => result.line).join('\n')
    const dialoguePath = join(outputDir, '03-grouped', 'dialogue.txt')
    await writeFile(dialoguePath, dialogueText, 'utf-8')

    if (!Array.isArray(groupedResults)) {
      differences.push('Grouped results is not an array')
    } else {
      for (let i = 0; i < groupedResults.length; i++) {
        const result = groupedResults[i]
        if (!result.line || typeof result.line !== 'string') {
          differences.push(`Grouped result ${i} missing or invalid line`)
        }
        if (!result.bbox) {
          differences.push(`Grouped result ${i} missing bbox`)
        } else {
          if (typeof result.bbox.x !== 'number' || result.bbox.x < 0) {
            differences.push(`Grouped result ${i} has invalid bbox.x`)
          }
          if (typeof result.bbox.y !== 'number' || result.bbox.y < 0) {
            differences.push(`Grouped result ${i} has invalid bbox.y`)
          }
          if (typeof result.bbox.width !== 'number') {
            differences.push(`Grouped result ${i} has invalid bbox.width type`)
          } else if (result.bbox.width <= 0) {
            console.warn(`Grouped result ${i} has zero or negative bbox.width (may be from empty tile)`)
          }
          if (typeof result.bbox.height !== 'number') {
            differences.push(`Grouped result ${i} has invalid bbox.height type`)
          } else if (result.bbox.height <= 0) {
            console.warn(`Grouped result ${i} has zero or negative bbox.height (may be from empty tile)`)
          }
        }
      }
    }

    // Step 4: Final Assertion
    console.log(`\nPipeline completed. Artifacts saved to: ${outputDir}`)
    console.log(`Tiles created: ${tiles.length}`)
    console.log(`OCR results: ${ocrResults.length}`)
    console.log(`Grouped results: ${groupedResults.length}`)

    if (differences.length > 0) {
      const errorMessage = `Pipeline differences found:\n${differences.join('\n')}\n\nArtifacts saved to: ${outputDir}`
      throw new Error(errorMessage)
    }
  }, 180000)
})

