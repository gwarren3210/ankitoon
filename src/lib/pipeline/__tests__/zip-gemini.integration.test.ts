import { describe, it, expect, beforeAll, afterEach } from 'bun:test'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'
import dotenv from 'dotenv'
import { extractImagesFromZip } from '@/lib/pipeline/zipExtractor'
import { stitchImageBuffers } from '@/lib/pipeline/imageStitcher'
import { createAdaptiveTiles } from '@/lib/pipeline/tiling'
import { processImage } from '@/lib/pipeline/ocr'
import { groupOcrIntoLines } from '@/lib/pipeline/textGrouper'
import { extractWords } from '@/lib/pipeline/translator'
import { OcrConfig } from '@/lib/pipeline/types'

dotenv.config({ path: join(process.cwd(), '.env') })

const TEST_DATA_DIR = join(__dirname, 'test-data')
const TEST_OUTPUT_DIR = join(__dirname, 'test-outputs')
const OCR_API_KEY = process.env.OCR_API_KEY || ''
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const SKIP_REASON = !OCR_API_KEY 
  ? 'OCR_API_KEY env var not set'
  : 'GEMINI_API_KEY env var not set'

/**
 * Delays execution for rate limiting between API calls.
 * Input: milliseconds
 * Output: promise resolving after delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Creates timestamped directory name.
 * Input: none
 * Output: timestamp string in YYYY-MM-DD_HH-MM-SS format
 */
function getTimestampDir(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`
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

describe('zip-gemini integration', () => {
  const skipTests = !OCR_API_KEY || !GEMINI_API_KEY

  if (skipTests) {
    it.skip(`SKIPPED: ${SKIP_REASON}`, () => {})
    return
  }

  let testZipBuffer: Buffer

  beforeAll(async () => {
    testZipBuffer = await readFile(
      join(TEST_DATA_DIR, 'solo-leveling-chapter-1.zip')
    )
  })

  afterEach(async () => {
    await delay(500)
  })

  describe('zip → extraction → stitching → tiling → OCR → grouping → Gemini', () => {
    it('processes zip file through full pipeline to Gemini word extraction', async () => {
      const timestampDir = getTimestampDir()
      const outputDir = join(TEST_OUTPUT_DIR, timestampDir)

      console.log(`\nStarting pipeline. Artifacts will be saved to: ${outputDir}`)

      // Step 1: Zip Extraction
      const extractedImages = await extractImagesFromZip(testZipBuffer)
      expect(extractedImages.length).toBeGreaterThan(0)
      console.log(`Extracted ${extractedImages.length} images from zip`)

      for (let i = 0; i < extractedImages.length; i++) {
        await saveBuffer(
          outputDir,
          '01-extracted-images',
          `image-${i}.png`,
          extractedImages[i]
        )
      }

      // Step 2: Image Stitching
      const stitchedImage = await stitchImageBuffers(extractedImages)
      expect(stitchedImage).toBeInstanceOf(Buffer)

      const stitchedMetadata = await sharp(stitchedImage).metadata()
      expect(stitchedMetadata.width).toBeGreaterThan(0)
      expect(stitchedMetadata.height).toBeGreaterThan(0)
      expect(stitchedMetadata.format).toBe('png')
      console.log(
        `Stitched image: ${stitchedMetadata.width}x${stitchedMetadata.height}`
      )

      await saveBuffer(outputDir, '02-stitched', 'stitched.png', stitchedImage)

      // Step 3: Tiling
      const tiles = await createAdaptiveTiles(stitchedImage, {
        fileSizeThreshold: 1 * 1024 * 1024 // 1MB (default)
      })

      const tilesMetadata = tiles.map((t, i) => ({
        index: i,
        startY: t.startY,
        width: t.width,
        height: t.height,
        bufferSize: t.buffer.length
      }))

      await saveJson(outputDir, '03-tiles', 'tiles-metadata.json', {
        tileCount: tiles.length,
        tiles: tilesMetadata
      })

      for (let i = 0; i < tiles.length; i++) {
        await saveBuffer(
          outputDir,
          '03-tiles',
          `tile-${i}.jpg`,
          tiles[i].buffer
        )
      }
      console.log(`Created ${tiles.length} tiles`)

      // Step 4: OCR Processing
      const ocrConfig: OcrConfig = {
        apiKey: OCR_API_KEY,
        language: 'kor',
        ocrEngine: 2,
        fileSizeThreshold: 1 * 1024 * 1024, // 1MB
        scale: false,
        overlapPercentage: 0.05 // 5%
      }

      const ocrResults = await processImage(stitchedImage, ocrConfig)
      expect(Array.isArray(ocrResults)).toBe(true)
      expect(ocrResults.length).toBeGreaterThan(0)
      console.log(`OCR extracted ${ocrResults.length} text segments`)

      // Validate OCR results structure
      for (let i = 0; i < ocrResults.length; i++) {
        const result = ocrResults[i]
        expect(result).toHaveProperty('text')
        expect(result).toHaveProperty('bbox')
        expect(result.bbox).toHaveProperty('x')
        expect(result.bbox).toHaveProperty('y')
        expect(result.bbox).toHaveProperty('width')
        expect(result.bbox).toHaveProperty('height')
      }

      await saveJson(
        outputDir,
        '04-ocr',
        'ocr-results.json',
        ocrResults
      )

      // Step 5: Text Grouping
      const groupedResults = await groupOcrIntoLines(ocrResults)
      expect(Array.isArray(groupedResults)).toBe(true)
      console.log(`Grouped into ${groupedResults.length} dialogue lines`)

      // Validate grouped results structure
      for (let i = 0; i < groupedResults.length; i++) {
        const result = groupedResults[i]
        expect(result).toHaveProperty('line')
        expect(result).toHaveProperty('bbox')
        expect(typeof result.line).toBe('string')
        expect(result.bbox).toHaveProperty('x')
        expect(result.bbox).toHaveProperty('y')
        expect(result.bbox).toHaveProperty('width')
        expect(result.bbox).toHaveProperty('height')
      }

      await saveJson(
        outputDir,
        '05-grouped',
        'grouped-results.json',
        groupedResults
      )

      // Step 6: Dialogue Extraction
      const dialogueText = groupedResults.map(result => result.line).join('\n')
      expect(dialogueText.trim().length).toBeGreaterThan(0)
      console.log(`Extracted dialogue: ${dialogueText.length} characters`)

      const dialoguePath = join(outputDir, '05-grouped', 'dialogue.txt')
      await writeFile(dialoguePath, dialogueText, 'utf-8')

      // Step 7: Word Extraction via Gemini
      const extractedWords = await extractWords(dialogueText, {
        apiKey: GEMINI_API_KEY
      })

      expect(Array.isArray(extractedWords)).toBe(true)
      console.log(`Gemini extracted ${extractedWords.length} words`)

      // Validate Gemini response structure
      for (const word of extractedWords) {
        expect(word).toHaveProperty('korean')
        expect(word).toHaveProperty('english')
        expect(word).toHaveProperty('importanceScore')
        expect(word).toHaveProperty('senseKey')
        expect(word).toHaveProperty('chapterExample')
        expect(word).toHaveProperty('globalExample')

        expect(typeof word.korean).toBe('string')
        expect(typeof word.english).toBe('string')
        expect(typeof word.importanceScore).toBe('number')
        expect(typeof word.senseKey).toBe('string')
        expect(typeof word.chapterExample).toBe('string')
        expect(typeof word.globalExample).toBe('string')

        expect(word.korean.trim().length).toBeGreaterThan(0)
        expect(word.english.trim().length).toBeGreaterThan(0)
        expect(word.importanceScore).toBeGreaterThanOrEqual(0)
        expect(word.importanceScore).toBeLessThanOrEqual(100)
        expect(word.senseKey.trim().length).toBeGreaterThan(0)
        expect(word.chapterExample.trim().length).toBeGreaterThan(0)
        expect(word.globalExample.trim().length).toBeGreaterThan(0)
      }

      // Save extracted words to JSON file
      await saveJson(
        outputDir,
        '06-gemini',
        'extracted-words.json',
        extractedWords
      )

      // Final summary
      console.log(`\nPipeline completed successfully!`)
      console.log(`Artifacts saved to: ${outputDir}`)
      console.log(`  - Extracted images: ${extractedImages.length}`)
      console.log(`  - Tiles created: ${tiles.length}`)
      console.log(`  - OCR results: ${ocrResults.length}`)
      console.log(`  - Dialogue lines: ${groupedResults.length}`)
      console.log(`  - Extracted words: ${extractedWords.length}`)
    }, 60 * 5 * 1000) // 5 minutes
  })
})

