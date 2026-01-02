import { TablesInsert } from '@/types/database.types'
import { logger } from '@/lib/logger'
import { DbClient, StudySessionData } from './types'

/**
 * Creates a study session record.
 * Input: supabase client, user id, chapter id, session data
 * Output: void
 */
export async function createStudySession(
  supabase: DbClient,
  userId: string,
  chapterId: string,
  sessionData: StudySessionData
): Promise<void> {
  const sessionRecord = buildSessionRecord(userId, chapterId, sessionData)

  logger.debug({ userId, chapterId, cardsStudied: sessionData.cardsStudied, accuracy: sessionData.accuracy, timeSpentSeconds: sessionData.timeSpentSeconds }, 'Creating study session')
  const { error } = await supabase
    .from('user_chapter_study_sessions')
    .insert(sessionRecord)

  if (error) {
    logger.error({ userId, chapterId, error: error.message, code: error.code }, 'Error creating study session')
    throw error
  }
  logger.info({ userId, chapterId, cardsStudied: sessionData.cardsStudied, accuracy: sessionData.accuracy, timeSpentSeconds: sessionData.timeSpentSeconds }, 'Study session created successfully')
}

/**
 * Builds session record from session data
 * Input: user id, chapter id, session data
 * Output: session insert data
 */
function buildSessionRecord(
  userId: string,
  chapterId: string,
  sessionData: StudySessionData
): TablesInsert<'user_chapter_study_sessions'> {
  return {
    user_id: userId,
    chapter_id: chapterId,
    cards_studied: sessionData.cardsStudied,
    accuracy: sessionData.accuracy,
    time_spent_seconds: sessionData.timeSpentSeconds,
    studied_at: sessionData.startTime.toISOString()
  }
}

