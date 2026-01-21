import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { processChapter } from '@/inngest/functions/processChapter'

/**
 * Inngest serve endpoint for Next.js App Router.
 * Handles all Inngest requests (function invocations, health checks).
 * Input: HTTP requests from Inngest orchestrator
 * Output: Function results or status
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processChapter]
})
