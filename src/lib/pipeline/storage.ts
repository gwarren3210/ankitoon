import { createServiceRoleClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import sharp from 'sharp'

const BUCKET = 'admin-uploads'
const PROCESSING_PREFIX = 'processing'
const TILES_PREFIX = 'tiles'

/**
 * Uploads a buffer to Supabase Storage for intermediate pipeline storage.
 * Input: jobId, filename, buffer data
 * Output: storage path string
 */
export async function uploadProcessingFile(
  jobId: string,
  fileName: string,
  buffer: Buffer
): Promise<string> {
  const supabase = createServiceRoleClient()
  const path = `${PROCESSING_PREFIX}/${jobId}/${fileName}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: getContentType(fileName),
      upsert: true
    })

  if (error) {
    logger.error({ jobId, fileName, error }, 'Failed to upload processing file')
    throw new Error(`Failed to upload processing file: ${error.message}`)
  }

  return path
}

/**
 * Downloads a file from Supabase Storage.
 * Input: storage path
 * Output: Buffer containing file data
 */
export async function downloadProcessingFile(path: string): Promise<Buffer> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(path)

  if (error) {
    logger.error({ path, error }, 'Failed to download processing file')
    throw new Error(`Failed to download processing file: ${error.message}`)
  }

  return Buffer.from(await data.arrayBuffer())
}

/**
 * Deletes all processing files for a job.
 * Input: jobId
 * Output: void (best-effort cleanup)
 */
export async function deleteProcessingFiles(jobId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const prefix = `${PROCESSING_PREFIX}/${jobId}`

  // List all files in the job's processing folder
  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET)
    .list(prefix)

  if (listError) {
    logger.warn({ jobId, listError }, 'Failed to list processing files for cleanup')
    return
  }

  if (!files || files.length === 0) {
    return
  }

  // Delete all files
  const paths = files.map(f => `${prefix}/${f.name}`)
  const { error: deleteError } = await supabase.storage
    .from(BUCKET)
    .remove(paths)

  if (deleteError) {
    logger.warn({ jobId, deleteError }, 'Failed to delete processing files')
  }
}

/**
 * Deletes a single file from storage.
 * Input: storage path
 * Output: void (best-effort cleanup)
 */
export async function deleteFile(path: string): Promise<void> {
  const supabase = createServiceRoleClient()

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([path])

  if (error) {
    logger.warn({ path, error }, 'Failed to delete file')
  }
}

/**
 * Gets content type based on file extension.
 * Input: filename
 * Output: MIME type string
 */
function getContentType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop()
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'webp':
      return 'image/webp'
    case 'json':
      return 'application/json'
    default:
      return 'application/octet-stream'
  }
}

// ============================================================================
// Tile Storage Functions
// Used for storing individual image tiles during batch OCR processing
// ============================================================================

/**
 * Uploads a single tile to storage.
 * Converts to JPEG for smaller file size (tiles are typically 50-300KB).
 * Input: jobId, tile index, image buffer
 * Output: storage path string
 */
export async function uploadTile(
  jobId: string,
  index: number,
  buffer: Buffer
): Promise<string> {
  const supabase = createServiceRoleClient()
  const path = `${PROCESSING_PREFIX}/${jobId}/${TILES_PREFIX}/tile-${index}.jpg`

  // Convert to JPEG for smaller size (tiles are ~50-300KB vs ~1MB as PNG)
  const jpegBuffer = await sharp(buffer)
    .jpeg({ quality: 85 })
    .toBuffer()

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, jpegBuffer, {
      contentType: 'image/jpeg',
      upsert: true
    })

  if (error) {
    logger.error({ jobId, index, error }, 'Failed to upload tile')
    throw new Error(`Failed to upload tile ${index}: ${error.message}`)
  }

  logger.debug({ jobId, index, size: jpegBuffer.length }, 'Uploaded tile')
  return path
}

/**
 * Downloads a single tile from storage.
 * Input: storage path
 * Output: Buffer containing tile image data
 */
export async function downloadTile(path: string): Promise<Buffer> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(path)

  if (error) {
    logger.error({ path, error }, 'Failed to download tile')
    throw new Error(`Failed to download tile: ${error.message}`)
  }

  return Buffer.from(await data.arrayBuffer())
}

/**
 * Deletes all tiles for a job.
 * Input: jobId
 * Output: void (best-effort cleanup)
 */
export async function deleteTiles(jobId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  const prefix = `${PROCESSING_PREFIX}/${jobId}/${TILES_PREFIX}`

  // List all tiles in the job's tiles folder
  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET)
    .list(prefix)

  if (listError) {
    logger.warn({ jobId, listError }, 'Failed to list tiles for cleanup')
    return
  }

  if (!files || files.length === 0) {
    return
  }

  // Delete all tiles
  const paths = files.map(f => `${prefix}/${f.name}`)
  const { error: deleteError } = await supabase.storage
    .from(BUCKET)
    .remove(paths)

  if (deleteError) {
    logger.warn({ jobId, deleteError }, 'Failed to delete tiles')
  } else {
    logger.debug({ jobId, tileCount: paths.length }, 'Deleted tiles')
  }
}
