import { inngest } from '../client'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { extractImagesFromZip } from '@/lib/pipeline/zipExtractor'
import { stitchImageBuffers } from '@/lib/pipeline/imageStitcher'
import {
  createAdaptiveTiles,
  adjustCoordinates,
  filterDuplicates
} from '@/lib/pipeline/tiling'
import {
  callOcrSpaceApi,
  parseOcrResponse,
  detectImageFormat
} from '@/lib/pipeline/ocr'
import { groupOcrIntoLines } from '@/lib/pipeline/textGrouper'
import { extractVocabularyAndGrammar } from '@/lib/pipeline/translator'
import {
  storeChapterVocabulary,
  storeChapterGrammar
} from '@/lib/pipeline/database'
import {
  uploadTile,
  downloadTile,
  deleteTiles,
  deleteFile
} from '@/lib/pipeline/storage'
import { OcrResultWithContext } from '@/lib/pipeline/types'
import { logger } from '@/lib/logger'

/** Number of tiles to process per Inngest step */
const TILES_PER_BATCH = 20

/** Metadata for a stored tile (path + coordinates for adjustment) */
type TileMetadata = {
  index: number
  path: string
  startY: number
  width: number
  height: number
}

/**
 * Inngest function for processing webtoon chapters.
 * Uses tile-based batch processing for resilience:
 * 1. Creates tiles from stitched image, uploads each (~50-300KB)
 * 2. Processes tiles in batches (retryable independently)
 * 3. Merges and deduplicates OCR results
 * 4. Extracts vocabulary via Gemini
 * 5. Stores in database
 * 6. Cleans up temp files
 */
export const processChapter = inngest.createFunction(
  {
    id: 'process-chapter',
    retries: 3
  },
  { event: 'pipeline/chapter.process' },
  async ({ event, step }) => {
    const {
      storagePath,
      seriesSlug,
      chapterNumber,
      chapterTitle,
      chapterLink
    } = event.data
    const jobId = event.id ?? `job-${Date.now()}`

    logger.info({ jobId, seriesSlug, chapterNumber }, 'Inngest job started')

    // =========================================================================
    // Step 1: Download ZIP, stitch images, create tiles, upload each tile
    // =========================================================================
    const tileMetadata = await step.run('prepare-tiles', async () => {
      logger.info({ jobId, storagePath }, 'Downloading and preparing tiles')

      // Download ZIP from Supabase Storage
      const supabase = createServiceRoleClient()
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from('admin-uploads')
        .download(storagePath)

      if (downloadError) {
        throw new Error(`Failed to download ZIP: ${downloadError.message}`)
      }

      const zipBuffer = Buffer.from(await fileBlob.arrayBuffer())
      logger.info({ jobId, zipSize: zipBuffer.length }, 'Downloaded ZIP')

      // Extract images from ZIP
      const imageBuffers = await extractImagesFromZip(zipBuffer)
      logger.info({ jobId, imageCount: imageBuffers.length }, 'Extracted images')

      // Stitch into single image
      const stitchedBuffer = await stitchImageBuffers(imageBuffers)
      logger.info(
        { jobId, stitchedSize: stitchedBuffer.length },
        'Stitched images'
      )

      // Create tiles (typically 50-300KB each after JPEG conversion)
      const tiles = await createAdaptiveTiles(stitchedBuffer)
      logger.info({ jobId, tileCount: tiles.length }, 'Created tiles')

      // Upload each tile and return metadata
      const metadata: TileMetadata[] = await Promise.all(
        tiles.map(async (tile, index) => {
          const path = await uploadTile(jobId, index, tile.buffer)
          return {
            index,
            path,
            startY: tile.startY,
            width: tile.width,
            height: tile.height
          }
        })
      )

      logger.info({ jobId, uploadedTiles: metadata.length }, 'Uploaded all tiles')
      return metadata
    })

    // =========================================================================
    // Step 2: Process tiles in batches (each batch is a separate Inngest step)
    // =========================================================================
    const numBatches = Math.ceil(tileMetadata.length / TILES_PER_BATCH)
    const allOcrResults: OcrResultWithContext[] = []

    logger.info(
      { jobId, totalTiles: tileMetadata.length, numBatches, tilesPerBatch: TILES_PER_BATCH },
      'Starting OCR batch processing'
    )

    for (let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
      const batchResults = await step.run(
        `ocr-batch-${batchIndex}`,
        async () => {
          const start = batchIndex * TILES_PER_BATCH
          const end = Math.min(start + TILES_PER_BATCH, tileMetadata.length)
          const batchTiles = tileMetadata.slice(start, end)

          logger.info(
            { jobId, batchIndex, tileRange: `${start}-${end - 1}` },
            'Processing OCR batch'
          )

          const results: OcrResultWithContext[] = []

          for (const tile of batchTiles) {
            // Download tile from storage
            const buffer = await downloadTile(tile.path)

            // Convert buffer to base64 data URL for OCR API
            const format = detectImageFormat(buffer)
            const base64Image = `data:${format.mimeType};base64,${buffer.toString('base64')}`

            // Call OCR API with full options
            const response = await callOcrSpaceApi(base64Image, {
              apiKey: process.env.OCR_API_KEY || '',
              language: 'kor',
              ocrEngine: '2',
              scale: false,
              isOverlayRequired: true,
              filetype: format.filetype
            })
            const parsed = parseOcrResponse(response)

            // Adjust coordinates from tile-relative to absolute
            const adjusted = adjustCoordinates(parsed, {
              buffer: Buffer.alloc(0), // Not needed for adjustment
              startY: tile.startY,
              width: tile.width,
              height: tile.height
            })

            results.push(...adjusted)
            logger.debug(
              { jobId, tileIndex: tile.index, ocrResultCount: parsed.length },
              'Processed tile'
            )
          }

          logger.info(
            { jobId, batchIndex, batchResultCount: results.length },
            'OCR batch completed'
          )

          return results
        }
      )

      allOcrResults.push(...batchResults)
    }

    // =========================================================================
    // Step 3: Merge and deduplicate OCR results from all batches
    // =========================================================================
    const ocrResults = await step.run('merge-results', async () => {
      logger.info(
        { jobId, totalRawResults: allOcrResults.length },
        'Merging and deduplicating OCR results'
      )

      const deduplicated = filterDuplicates(allOcrResults)

      logger.info(
        { jobId, deduplicatedCount: deduplicated.length },
        'Deduplication completed'
      )

      return deduplicated
    })

    if (ocrResults.length === 0) {
      throw new Error('No text detected in image')
    }

    // =========================================================================
    // Step 4: Group text and extract vocabulary via Gemini
    // =========================================================================
    const extraction = await step.run('extract-vocabulary', async () => {
      logger.info({ jobId }, 'Extracting vocabulary and grammar')

      // Group OCR results into dialogue lines
      const dialogueLines = await groupOcrIntoLines(ocrResults)
      const dialogue = dialogueLines.map(l => l.line).join('\n')

      if (!dialogue || dialogue.trim().length === 0) {
        throw new Error('No dialogue extracted from OCR results')
      }

      logger.info(
        { jobId, dialogueLength: dialogue.length, lineCount: dialogueLines.length },
        'Dialogue grouped'
      )

      // Extract vocabulary and grammar via Gemini
      const result = await extractVocabularyAndGrammar(dialogue, {
        apiKey: process.env.GEMINI_API_KEY || ''
      })

      if (result.vocabulary.length === 0 && result.grammar.length === 0) {
        throw new Error('No vocabulary or grammar extracted')
      }

      logger.info(
        {
          jobId,
          vocabularyCount: result.vocabulary.length,
          grammarCount: result.grammar.length
        },
        'Extraction completed'
      )

      return {
        vocabulary: result.vocabulary,
        grammar: result.grammar,
        dialogueLinesCount: dialogueLines.length
      }
    })

    // =========================================================================
    // Step 5: Store results in database
    // =========================================================================
    const storeResult = await step.run('store-results', async () => {
      logger.info({ jobId }, 'Storing results in database')

      // Store vocabulary
      const vocabResult = await storeChapterVocabulary(
        extraction.vocabulary,
        seriesSlug,
        chapterNumber,
        chapterTitle,
        chapterLink
      )

      // Store grammar
      const grammarResult = await storeChapterGrammar(
        extraction.grammar,
        seriesSlug,
        chapterNumber,
        chapterTitle,
        chapterLink
      )

      logger.info(
        {
          jobId,
          newWordsInserted: vocabResult.newWordsInserted,
          newGrammarInserted: grammarResult.newGrammarInserted
        },
        'Database storage completed'
      )

      return {
        chapterId: vocabResult.chapterId,
        newWordsInserted: vocabResult.newWordsInserted,
        totalWordsInChapter: vocabResult.totalWordsInChapter,
        newGrammarInserted: grammarResult.newGrammarInserted,
        totalGrammarInChapter: grammarResult.totalGrammarInChapter
      }
    })

    // =========================================================================
    // Step 6: Cleanup temp files (best-effort, non-critical)
    // =========================================================================
    await step.run('cleanup', async () => {
      logger.info({ jobId, storagePath }, 'Cleaning up temp files')

      // Delete all tiles for this job
      await deleteTiles(jobId)

      // Delete original temp ZIP
      await deleteFile(storagePath)

      logger.info({ jobId }, 'Cleanup completed')
    })

    // Build final result
    const finalResult = {
      success: true,
      chapterId: storeResult.chapterId,
      seriesSlug,
      chapterNumber,
      newWordsInserted: storeResult.newWordsInserted,
      totalWordsInChapter: storeResult.totalWordsInChapter,
      newGrammarInserted: storeResult.newGrammarInserted,
      totalGrammarInChapter: storeResult.totalGrammarInChapter,
      dialogueLinesCount: extraction.dialogueLinesCount,
      vocabularyExtracted: extraction.vocabulary.length,
      grammarExtracted: extraction.grammar.length
    }

    logger.info({ jobId, ...finalResult }, 'Inngest job completed successfully')

    return finalResult
  }
)
