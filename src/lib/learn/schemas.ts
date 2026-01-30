import { z } from 'zod'
import { cardSchema, studyCardSchema } from '@/lib/study/schemas'

/**
 * Zod schema for distractor option from user's difficult cards.
 */
export const distractorOptionSchema = z.object({
  term: z.string(),
  definition: z.string(),
  difficulty: z.number()
})

/**
 * Extended study card schema with deckId for learn sessions.
 */
export const learnCardSchema = studyCardSchema.extend({
  deckId: z.string()
})

/**
 * Zod schema for learn session start request.
 */
export const startLearnSessionSchema = z.object({
  chapterId: z.string().regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Invalid UUID format'
  )
})

/**
 * Zod schema for learn session start response.
 */
export const learnSessionStartResponseSchema = z.object({
  sessionId: z.string(),
  deckId: z.string(),
  cards: z.array(learnCardSchema),
  fallbackDistractors: z.array(distractorOptionSchema),
  numCards: z.number()
})

/**
 * Zod schema for graduated card in complete request.
 */
export const graduatedCardSchema = z.object({
  srsCardId: z.string(),
  fsrsCard: cardSchema
})

/**
 * Zod schema for learn session complete request.
 */
export const completeLearnSessionSchema = z.object({
  sessionId: z.string(),
  deckId: z.string(),
  graduatedCards: z.array(graduatedCardSchema)
})

/**
 * Zod schema for learn session complete response.
 */
export const learnSessionCompleteResponseSchema = z.object({
  success: z.boolean(),
  cardsGraduated: z.number()
})

// Type exports
export type StartLearnSessionRequest = z.infer<typeof startLearnSessionSchema>
export type LearnSessionStartResponse = z.infer<
  typeof learnSessionStartResponseSchema
>
export type CompleteLearnSessionRequest = z.infer<
  typeof completeLearnSessionSchema
>
export type LearnSessionCompleteResponse = z.infer<
  typeof learnSessionCompleteResponseSchema
>
