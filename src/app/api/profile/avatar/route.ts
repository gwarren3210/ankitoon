import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import {
  withErrorHandler,
  requireAuth,
  successResponse,
  BadRequestError,
  DatabaseError
} from '@/lib/api'
import {
  validateImageFile,
  generateSecureFilename,
  checkMalwareSignatures
} from '@/lib/uploads/fileValidator'

/**
 * POST /api/profile/avatar
 * Upload avatar image to Supabase Storage.
 * Input: FormData with 'file' field
 * Output: avatar URL
 *
 * Security: Validates magic bytes, re-encodes image to strip metadata,
 * uses unpredictable filenames, and scans for malware signatures.
 */
async function handler(request: NextRequest) {
  const { user } = await requireAuth()
  const supabase = await createClient()

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    throw new BadRequestError('No file provided')
  }

  const { buffer } = await validateImageFile(file)

  if (!checkMalwareSignatures(buffer)) {
    logger.warn({ userId: user.id }, 'Malware signature detected in avatar upload')
    throw new BadRequestError('File failed security scan')
  }

  const fileName = generateSecureFilename(user.id)
  const filePath = `avatars/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, buffer, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false
    })

  if (uploadError) {
    logger.error({ userId: user.id, uploadError }, 'Error uploading avatar')
    throw new DatabaseError('Failed to upload avatar', uploadError)
  }

  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath)

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', user.id)

  if (updateError) {
    logger.error({ userId: user.id, updateError }, 'Error updating avatar URL')
    throw new DatabaseError('Failed to update avatar URL', updateError)
  }

  logger.info({ userId: user.id, avatarUrl: publicUrl }, 'Avatar uploaded successfully')

  return successResponse({ avatar_url: publicUrl })
}

export const POST = withErrorHandler(handler)
