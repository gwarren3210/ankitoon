import { z } from 'zod'
import { State, Rating } from 'ts-fsrs'
import { FsrsCard } from '@/lib/study/fsrs'

const stateValues = Object.values(State).filter((v): v is number => typeof v === 'number')
const ratingValues = Object.values(Rating).filter((v): v is number => typeof v === 'number')

/**
 * Zod schema for validating FSRS Card structure
 * Handles date transformations from string to Date
 */
export const cardSchema: z.ZodType<FsrsCard> = z.object({
  due: z.union([z.string(), z.date()]).transform((val) => 
    typeof val === 'string' ? new Date(val) : val
  ),
  stability: z.number().min(0),
  difficulty: z.number().min(0),
  elapsed_days: z.number().min(0),
  scheduled_days: z.number().min(0),
  learning_steps: z.number().min(0),
  reps: z.number().min(0),
  lapses: z.number().min(0),
  state: z.number().refine((val) => stateValues.includes(val), {
    message: 'Invalid state value'
  }),
  last_review: z.union([z.string(), z.date(), z.undefined()]).transform((val) => 
    val ? (typeof val === 'string' ? new Date(val) : val) : undefined
  ).optional()
}) as z.ZodType<FsrsCard>

/**
 * Zod schema for rate request validation
 */
export const rateRequestSchema = z.object({
  sessionId: z.string().min(1),
  vocabularyId: z.string().min(1),
  rating: z.number().refine((val) => ratingValues.includes(val), {
    message: 'Invalid rating value'
  }),
  card: cardSchema
})

export type RateRequest = z.infer<typeof rateRequestSchema>

/**
 * Zod schema for starting a study session
 */
export const startSessionSchema = z.object({
  chapterId: z.string().regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Invalid UUID format'
  )
})

/**
 * Zod schema for ending a study session
 */
export const endSessionSchema = z.object({
  sessionId: z.string().regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Invalid UUID format'
  )
})

/**
 * Zod schema for session request (union of start or end)
 */
export const sessionRequestSchema = z.union([
  startSessionSchema,
  endSessionSchema
])

export type StartSessionRequest = z.infer<typeof startSessionSchema>
export type EndSessionRequest = z.infer<typeof endSessionSchema>

/**
 * Zod schema for StudyCard response (deserializes dates from strings)
 */
export const studyCardSchema = z.object({
  srsCard: cardSchema,
  vocabulary: z.object({
    id: z.string(),
    term: z.string(),
    definition: z.string(),
    example: z.string().nullable(),
    sense_key: z.string(),
    created_at: z.string()
  }),
  srsCardId: z.string()
})

/**
 * Zod schema for session start response
 */
export const sessionStartResponseSchema = z.object({
  sessionId: z.string(),
  deckId: z.string(),
  cards: z.array(studyCardSchema),
  numNewCards: z.number(),
  numCards: z.number(),
  startTime: z.string()
})

/**
 * Zod schema for rate response
 */
export const rateResponseSchema = z.object({
  success: z.boolean(),
  reAddCard: z.boolean(),
  card: cardSchema,
  nextReview: z.string()
})
