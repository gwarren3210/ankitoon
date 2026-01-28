import { EventSchemas, Inngest } from 'inngest'

/**
 * Event types for type-safe event sending and function triggers.
 */
type ChapterProcessEvent = {
  data: {
    storagePath: string
    seriesSlug: string
    chapterNumber: number
    chapterTitle?: string
    chapterLink?: string
  }
}

type Events = {
  'pipeline/chapter.process': ChapterProcessEvent
}

/**
 * Inngest client for AnkiToon.
 * Used to send events and define functions.
 * Input: none (singleton)
 * Output: Inngest client instance
 */
export const inngest = new Inngest({
  id: 'ankitoon',
  schemas: new EventSchemas().fromRecord<Events>()
})
