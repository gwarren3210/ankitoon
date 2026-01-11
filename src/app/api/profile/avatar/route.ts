import { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import {
  withErrorHandler,
  requireAuth,
  successResponse,
  BadRequestError,
  DatabaseError
} from '@/lib/api'

/**
 * POST /api/profile/avatar
 * Upload avatar image to Supabase Storage.
 * Input: FormData with 'file' field
 * Output: avatar URL
 */
async function handler(request: NextRequest) {
  const { user, supabase } = await requireAuth()

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    throw new BadRequestError('No file provided')
  }

  if (!file.type.startsWith('image/')) {
    throw new BadRequestError('File must be an image')
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new BadRequestError('File size must be less than 5MB')
  }

  const fileExt = file.name.split('.').pop()
  const fileName = `${user.id}-${Date.now()}.${fileExt}`
  const filePath = `avatars/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
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
