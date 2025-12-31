import { z } from 'zod'

/**
 * Zod schema for updating profile study settings
 */
export const profileSettingsSchema = z.object({
  max_new_cards: z.number().int().min(1).max(50).optional(),
  max_total_cards: z.number().int().min(1).max(100).optional()
}).refine(
  (data) => data.max_new_cards !== undefined || data.max_total_cards !== undefined,
  { message: 'At least one field must be provided' }
)

export type ProfileSettingsRequest = z.infer<typeof profileSettingsSchema>

/**
 * Zod schema for updating profile information
 */
export const profileUpdateSchema = z.object({
  username: z.union([
    z.string().regex(/^[a-zA-Z0-9_-]{3,20}$/, 'Username must be 3-20 characters and contain only letters, numbers, underscores, and hyphens'),
    z.string().length(0),
    z.null()
  ]).optional(),
  avatar_url: z.string().regex(
    /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
    'Invalid URL format'
  ).optional().nullable()
}).refine(
  (data) => data.username !== undefined || data.avatar_url !== undefined,
  { message: 'At least one field must be provided' }
)

export type ProfileUpdateRequest = z.infer<typeof profileUpdateSchema>

