/**
 * File Upload Validation Service
 * Provides secure file validation for image uploads with magic byte
 * verification, content sanitization, and malware detection.
 */

import { fileTypeFromBuffer } from 'file-type'
import sharp from 'sharp'
import { createHash, randomUUID } from 'crypto'
import { logger } from '@/lib/logger'
import { BadRequestError } from '@/lib/api'

/**
 * Allowed image MIME types (by magic bytes, not client header).
 * SVG intentionally excluded due to XSS risk.
 */
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp'
] as const

type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number]

/** Maximum file size: 5MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024

/** Maximum image dimensions to prevent ZIP bomb attacks */
const MAX_DIMENSIONS = { width: 2048, height: 2048 }

/** Output quality for re-encoded JPEG */
const JPEG_QUALITY = 85

/**
 * Result of successful image validation.
 */
export interface ValidatedImage {
  /** Sanitized image buffer (re-encoded JPEG) */
  buffer: Buffer
  /** Output MIME type (always image/jpeg after re-encoding) */
  mimeType: 'image/jpeg'
  /** Original image width */
  width: number
  /** Original image height */
  height: number
}

/**
 * Validates and sanitizes an uploaded image file.
 * Input: File from FormData
 * Output: Sanitized image buffer with metadata
 *
 * Security measures:
 * 1. Size check (before reading full buffer)
 * 2. Magic byte validation (real file format)
 * 3. Dimension validation (prevent ZIP bombs)
 * 4. Re-encoding (strips metadata and hidden content)
 */
export async function validateImageFile(file: File): Promise<ValidatedImage> {
  if (file.size > MAX_FILE_SIZE) {
    throw new BadRequestError(
      `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`
    )
  }

  if (file.size === 0) {
    throw new BadRequestError('File is empty')
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const detectedType = await fileTypeFromBuffer(buffer)

  if (!detectedType) {
    logger.warn(
      { fileName: file.name, claimedType: file.type },
      'Could not detect file type from magic bytes'
    )
    throw new BadRequestError('Invalid file format')
  }

  if (!isAllowedMimeType(detectedType.mime)) {
    logger.warn(
      { fileName: file.name, detectedType: detectedType.mime },
      'Disallowed file type detected'
    )
    throw new BadRequestError(
      `Only JPEG, PNG, and WebP images are allowed`
    )
  }

  const metadata = await getImageMetadata(buffer)

  if (!metadata.width || !metadata.height) {
    throw new BadRequestError('Could not read image dimensions')
  }

  if (
    metadata.width > MAX_DIMENSIONS.width ||
    metadata.height > MAX_DIMENSIONS.height
  ) {
    throw new BadRequestError(
      `Image dimensions must be ${MAX_DIMENSIONS.width}x${MAX_DIMENSIONS.height} or smaller`
    )
  }

  const sanitizedBuffer = await sanitizeImage(buffer)

  logger.info(
    {
      originalSize: file.size,
      sanitizedSize: sanitizedBuffer.length,
      detectedType: detectedType.mime,
      dimensions: `${metadata.width}x${metadata.height}`
    },
    'Image validated and sanitized'
  )

  return {
    buffer: sanitizedBuffer,
    mimeType: 'image/jpeg',
    width: metadata.width,
    height: metadata.height
  }
}

/**
 * Generates a secure, unpredictable filename for storage.
 * Input: User ID
 * Output: Path in format {userIdHash}/{uuid}.jpg
 *
 * Security: Uses SHA-256 hash of user ID (not raw ID) and random UUID
 * to prevent enumeration attacks.
 */
export function generateSecureFilename(userId: string): string {
  const userHash = hashUserId(userId)
  const uniqueId = randomUUID()
  return `${userHash}/${uniqueId}.jpg`
}

/**
 * Checks buffer for common malware signatures.
 * Input: File buffer
 * Output: true if safe, false if suspicious patterns detected
 *
 * Note: This is a basic check. For production, consider integrating
 * with ClamAV or VirusTotal for comprehensive scanning.
 */
export function checkMalwareSignatures(buffer: Buffer): boolean {
  const contentSample = buffer.toString('utf-8', 0, Math.min(buffer.length, 2048))

  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on(error|load|click|mouseover)=/i,
    /<\?php/i,
    /<%[\s=@]/,
    /eval\s*\(/i,
    /system\s*\(/i,
    /exec\s*\(/i,
    /shell_exec/i,
    /passthru/i,
    /base64_decode/i,
    /document\.(cookie|location|write)/i
  ]

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(contentSample)) {
      logger.warn(
        { pattern: pattern.source },
        'Suspicious pattern detected in upload'
      )
      return false
    }
  }

  return true
}

/**
 * Type guard for allowed MIME types.
 */
function isAllowedMimeType(mime: string): mime is AllowedMimeType {
  return ALLOWED_MIME_TYPES.includes(mime as AllowedMimeType)
}

/**
 * Gets image metadata using sharp.
 * Input: Image buffer
 * Output: Metadata including dimensions
 */
async function getImageMetadata(buffer: Buffer) {
  try {
    return await sharp(buffer).metadata()
  } catch {
    throw new BadRequestError('Invalid or corrupted image file')
  }
}

/**
 * Re-encodes image to JPEG to sanitize content.
 * Input: Original image buffer
 * Output: Re-encoded JPEG buffer
 *
 * This strips:
 * - EXIF metadata (GPS, camera info, etc.)
 * - Embedded profiles
 * - Any hidden content/steganography
 */
async function sanitizeImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(MAX_DIMENSIONS.width, MAX_DIMENSIONS.height, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer()
}

/**
 * Hashes user ID for filename directory.
 * Input: User ID string
 * Output: First 8 characters of SHA-256 hash
 */
function hashUserId(userId: string): string {
  return createHash('sha256')
    .update(userId)
    .digest('hex')
    .substring(0, 8)
}
