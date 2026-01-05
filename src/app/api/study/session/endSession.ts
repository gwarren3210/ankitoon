import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getSession,
  deleteSession,
} from '@/lib/study/sessionCache'
import { createStudySession } from '@/lib/study/sessions'
import { updateChapterProgress, updateSeriesProgress } from '@/lib/study/progress'
import { persistSessionReviews, ReviewLogEntry } from '@/lib/study/batchCardUpdates'
import { logger } from '@/lib/logger'
import { Card } from 'ts-fsrs'

/**
 * Handles ending a study session.
 * Input: supabase client, user id, session id
 * Output: NextResponse with session end result
 */
export async function handleEndSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sessionId: string
) {
  logger.info({ userId, sessionId }, 'Ending study session')
  
  try {
    const session = await getSession(sessionId)
    if (!session) {
      logger.warn({ userId, sessionId }, 'Session not found or expired')
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 404 }
      )
    }

    if (session.userId !== userId) {
      logger.warn({ userId, sessionUserId: session.userId, sessionId }, 'Unauthorized access attempt to session')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    logger.debug({
      userId,
      sessionId,
      chapterId: session.chapterId,
      deckId: session.deckId,
      vocabularyCount: session.vocabulary.size,
      cardsCount: session.cards.size,
      logsCount: Array.from(session.logs.values()).reduce(
        (sum, logs) => sum + logs.length,
        0
      )
    }, 'Session retrieved, collecting cards and logs for batch processing')

    // Collect all cards and logs for batch processing
    const cardsToUpdate = new Map<string, Card>()
    const logsToPersist: ReviewLogEntry[] = []
    let totalLogs = 0
    let logsWithGoodRating = 0

    for (const [vocabularyId, logs] of session.logs.entries()) {
      if (logs.length === 0) continue

      const finalCard = session.cards.get(vocabularyId)
      if (!finalCard) continue

      cardsToUpdate.set(vocabularyId, finalCard)

      const srsCardId = session.srsCardIds.get(vocabularyId)
      if (!srsCardId) {
        logger.error(
          { userId, vocabularyId, deckId: session.deckId },
          'Missing srsCardId for vocabulary in session cache'
        )
        throw new Error(
          `Missing srsCardId for vocabulary in session cache: ${vocabularyId}`
        )
      }
      for (const log of logs) {
        logsToPersist.push({
          vocabularyId,
          log,
          srsCardId
        })
        totalLogs++
        if (log.rating >= 3) {
          logsWithGoodRating++
        }
      }
    }

    logger.info({
      userId,
      sessionId,
      deckId: session.deckId,
      cardsToUpdate: cardsToUpdate.size,
      logsToPersist: logsToPersist.length,
      totalLogs
    }, 'Persisting session reviews to database')

    // Persist cards and logs using RPC transaction
    try {
      await persistSessionReviews(
        supabase,
        userId,
        session.deckId,
        cardsToUpdate,
        logsToPersist
      )
      logger.debug({
        userId,
        sessionId,
        deckId: session.deckId,
        cardsUpdated: cardsToUpdate.size,
        logsPersisted: logsToPersist.length
      }, 'Session reviews persisted successfully')
    } catch (error) {
      logger.error({
        userId,
        deckId: session.deckId,
        cardsCount: cardsToUpdate.size,
        logsCount: logsToPersist.length,
        error
      }, 'Error persisting session reviews')
      throw error
    }

    // Calculate session stats
    const cardsStudied = totalLogs
    const accuracy = cardsStudied > 0
      ? (logsWithGoodRating / cardsStudied) * 100
      : 0
    const timeSpentSeconds = Math.floor(
      (new Date().getTime() - session.createdAt.getTime()) / 1000
    )

    // Get chapter series_id
    let chapter
    try {
      const { data: chapterData, error: chapterError } = await supabase
        .from('chapters')
        .select('series_id')
        .eq('id', session.chapterId)
        .single()

      if (chapterError) {
        logger.error({ userId, chapterId: session.chapterId, error: chapterError.message, code: chapterError.code }, 'Error fetching chapter data')
        throw chapterError
      }
      chapter = chapterData
    } catch (error) {
      logger.error({ userId, chapterId: session.chapterId, error }, 'Error getting chapter series_id')
      throw error
    }

    if (chapter) {
      logger.debug({
        userId,
        sessionId,
        chapterId: session.chapterId,
        seriesId: chapter.series_id,
        cardsStudied,
        accuracy,
        timeSpentSeconds
      }, 'Creating study session record and updating progress')

      // Run createStudySession and updateChapterProgress in parallel
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [_, __] = await Promise.all([
          createStudySession(supabase, userId, session.chapterId, {
            deckId: session.deckId,
            cardsStudied,
            accuracy: accuracy / 100,
            timeSpentSeconds,
            startTime: session.createdAt,
            endTime: new Date()
          }).catch(error => {
            logger.error({ userId, chapterId: session.chapterId, error }, 'Error creating study session')
            throw error
          }),
          updateChapterProgress(
            supabase,
            userId,
            session.chapterId,
            chapter.series_id,
            session.deckId,
            accuracy / 100,
            timeSpentSeconds,
            session.cards
          ).catch(error => {
            logger.error({ userId, chapterId: session.chapterId, error }, 'Error updating chapter progress')
            throw error
          })
        ])
      } catch (error) {
        logger.error({ userId, chapterId: session.chapterId, error }, 'Error in parallel session/progress operations')
        throw error
      }

      logger.debug({
        userId,
        sessionId,
        chapterId: session.chapterId,
        seriesId: chapter.series_id
      }, 'Updating series progress after chapter progress update')

      // Update series progress after chapter progress
      try {
        await updateSeriesProgress(
          supabase,
          userId,
          chapter.series_id
        )
        logger.debug({
          userId,
          sessionId,
          seriesId: chapter.series_id
        }, 'Series progress updated successfully')
      } catch (error) {
        logger.error({
          userId,
          sessionId,
          seriesId: chapter.series_id,
          error
        }, 'Error updating series progress')
        // Don't throw - series progress update failure shouldn't fail the whole operation
      }
    } else {
      logger.warn({
        userId,
        sessionId,
        chapterId: session.chapterId
      }, 'Chapter not found, skipping progress updates')
    }

    // Delete session from cache (even if persistence failed)
    logger.debug({ userId, sessionId }, 'Deleting session from cache')
    try {
      await deleteSession(sessionId)
      logger.debug({ userId, sessionId }, 'Session deleted from cache successfully')
    } catch (deleteError) {
      logger.error({ sessionId, userId, error: deleteError }, 'Failed to delete session from cache after ending session')
      // Continue - session deletion failure shouldn't fail the whole operation
    }

    logger.info({
      userId,
      sessionId,
      chapterId: session.chapterId,
      cardsStudied,
      accuracy,
      timeSpentSeconds,
      startTime: session.createdAt,
      endTime: new Date()
    }, 'Session ended successfully')

    return NextResponse.json({
      success: true,
      cardsStudied,
      accuracy,
      timeSpentSeconds
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    logger.error(
      { sessionId, userId, error: errorMessage, stack: errorStack },
      'Error ending session'
    )
    throw error // Re-throw to be caught by POST handler
  }
}

