import { Database, TablesInsert, TablesUpdate } from '@/types/database.types'
import { logger } from '@/lib/logger'
import { DbClient } from './types'
import { FsrsCard, FsrsState } from './fsrs'

/**
 * Updates chapter progress summary after a study session.
 * Input: supabase client, user id, chapter id, series id, deck id, session results, optional session cards
 * Output: void
 */
export async function updateChapterProgress(
  supabase: DbClient,
  userId: string,
  chapterId: string,
  seriesId: string,
  deckId: string,
  accuracy: number,
  timeSpentSeconds: number,
  sessionCards: Map<string, FsrsCard>,
): Promise<void> {
  logger.debug({ userId, chapterId, seriesId, accuracy, timeSpentSeconds }, 'Updating chapter progress')
  
  const uniqueCardsStudied = sessionCards.size
  const newCardsStudied = Array.from(sessionCards.values()).filter(card => card.state === FsrsState.New).length

  const currentProgress = await getCurrentChapterProgress(supabase, userId, chapterId)
  
  const now = new Date()

  if (currentProgress) {
    await updateExistingChapterProgress(
      supabase,
      userId,
      chapterId,
      currentProgress,
      newCardsStudied,
      uniqueCardsStudied,
      accuracy,
      timeSpentSeconds,
      now
    )
  } else {
    await createNewChapterProgress(
      supabase,
      userId,
      chapterId,
      seriesId,
      newCardsStudied,
      uniqueCardsStudied,
      accuracy,
      timeSpentSeconds,
      now
    )
  }
}


/**
 * Gets current chapter progress
 * Input: supabase client, user id, chapter id
 * Output: current progress or null
 */
async function getCurrentChapterProgress(
  supabase: DbClient,
  userId: string,
  chapterId: string
) {
  const { data: currentProgress, error: fetchError } = await supabase
    .from('user_chapter_progress_summary')
    .select('*')
    .eq('user_id', userId)
    .eq('chapter_id', chapterId)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    logger.error({ userId, chapterId, error: fetchError.message, code: fetchError.code }, 'Error fetching chapter progress')
    throw fetchError
  }

  return currentProgress
}

/**
 * Updates existing chapter progress
 * Input: supabase client, user id, chapter id, current progress, session data, timestamp
 * Output: void
 *       supabase,
      userId,
      chapterId,
      currentProgress,
      newCardsStudied,
      uniqueCardsStudied,
      accuracy,
      timeSpentSeconds,
      now
 */
async function updateExistingChapterProgress(
  supabase: DbClient,
  userId: string,
  chapterId: string,
  currentProgress: Database['public']['Tables']['user_chapter_progress_summary']['Row'],
  newCardsStudied: number,
  uniqueCardsStudied: number,
  accuracy: number,
  timeSpentSeconds: number,
  now: Date
): Promise<void> {
  const previousAccuracy = currentProgress.accuracy ?? 0
  const totalAccuracy = (previousAccuracy * currentProgress.num_cards_studied + accuracy * uniqueCardsStudied) / newCardsStudied
  const newTimeSpent = (currentProgress.time_spent_seconds || 0) + timeSpentSeconds
  const newUniqueVocabSeen = currentProgress.unique_vocab_seen + newCardsStudied
  const newCompleted = (currentProgress.total_cards && newCardsStudied >= currentProgress.total_cards) ? true : false
  const newTotalCards = currentProgress.total_cards ? currentProgress.total_cards + uniqueCardsStudied : uniqueCardsStudied
  const updateData: TablesUpdate<'user_chapter_progress_summary'> = {
    num_cards_studied: newTotalCards, // cards studied so far, one card per session
    unique_vocab_seen: newUniqueVocabSeen, // unique vocab seen so far
    completed: newCompleted,
    accuracy: totalAccuracy,
    time_spent_seconds: newTimeSpent,
    last_studied: now.toISOString(),
    updated_at: now.toISOString()
  }

  const { error } = await supabase
    .from('user_chapter_progress_summary')
    .update(updateData)
    .eq('user_id', userId)
    .eq('chapter_id', chapterId)

  if (error) {
    logger.error({ userId, chapterId, error: error.message, code: error.code }, 'Error updating chapter progress')
    throw error
  }
  logger.info({ userId, chapterId, newCardsStudied, uniqueCardsStudied, accuracy, timeSpentSeconds }, 'Chapter progress updated')
}



/**
 * Creates new chapter progress record
 * Input: supabase client, user id, chapter id, series id, stats, timestamp
 * Output: void
 */
async function createNewChapterProgress(
  supabase: DbClient,
  userId: string,
  chapterId: string,
  seriesId: string,
  newCardsStudied: number,
  uniqueCardsStudied: number,
  accuracy: number,
  timeSpentSeconds: number,
  now: Date
): Promise<void> {
  const insertData: TablesInsert<'user_chapter_progress_summary'> = {
    user_id: userId,
    chapter_id: chapterId,
    series_id: seriesId,
    num_cards_studied: uniqueCardsStudied,
    unique_vocab_seen: newCardsStudied,
    accuracy: accuracy,
    time_spent_seconds: timeSpentSeconds,
    last_studied: now.toISOString(),
    first_studied: now.toISOString()
  }

  const { error } = await supabase
    .from('user_chapter_progress_summary')
    .insert(insertData)

  if (error) {
    logger.error({ userId, chapterId, error: error.message, code: error.code }, 'Error creating chapter progress')
    throw error
  }
  logger.info({ userId, chapterId, newCardsStudied, uniqueCardsStudied, accuracy, timeSpentSeconds }, 'Chapter progress created')
}

/**
 * Updates series progress summary by aggregating chapter progress.
 * Input: supabase client, user id, series id
 * Output: void
 */
export async function updateSeriesProgress(
  supabase: DbClient,
  userId: string,
  seriesId: string
): Promise<void> {
  logger.debug({ userId, seriesId }, 'Updating series progress')

  const chapterIds = await getChapterIdsForSeries(supabase, seriesId)
  const totalChaptersCount = chapterIds.length
  const chapterProgress = await getChapterProgressForSeries(supabase, userId, seriesId)
  
  const stats = await calculateSeriesStats(supabase, userId, chapterIds, chapterProgress)
  const currentProgress = await getCurrentSeriesProgress(supabase, userId, seriesId)
  
  const now = new Date()

  if (currentProgress) {
    await updateExistingSeriesProgress(
      supabase,
      userId,
      seriesId,
      totalChaptersCount,
      stats,
      now
    )
  } else {
    await createNewSeriesProgress(
      supabase,
      userId,
      seriesId,
      totalChaptersCount,
      stats
    )
  }
}

/**
 * Gets chapter IDs for a series
 * Input: supabase client, series id
 * Output: array of chapter IDs
 */
async function getChapterIdsForSeries(
  supabase: DbClient,
  seriesId: string
): Promise<string[]> {
  const { data: chapters, error: chaptersError } = await supabase
    .from('chapters')
    .select('id')
    .eq('series_id', seriesId)

  if (chaptersError) {
    logger.error({ seriesId, error: chaptersError.message, code: chaptersError.code }, 'Error fetching chapters')
    throw chaptersError
  }

  return chapters?.map(ch => ch.id) || []
}

/**
 * Gets chapter progress for a series
 * Input: supabase client, user id, series id
 * Output: array of chapter progress records
 */
async function getChapterProgressForSeries(
  supabase: DbClient,
  userId: string,
  seriesId: string
) {
  const { data: chapterProgress, error: progressError } = await supabase
    .from('user_chapter_progress_summary')
    .select('*')
    .eq('user_id', userId)
    .eq('series_id', seriesId)

  if (progressError) {
    logger.error({ userId, seriesId, error: progressError.message, code: progressError.code }, 'Error fetching chapter progress')
    throw progressError
  }

  return chapterProgress || []
}

/**
 * Calculates aggregated stats for series
 * Input: supabase client, user id, chapter ids, chapter progress
 * Output: aggregated stats object
 */
async function calculateSeriesStats(
  supabase: DbClient,
  userId: string,
  chapterIds: string[],
  chapterProgress: Database['public']['Tables']['user_chapter_progress_summary']['Row'][]
) {
  const chaptersCompleted = chapterProgress.filter(cp => cp.completed).length
  const totalCards = chapterProgress.reduce((sum, cp) => sum + (cp.total_cards || 0), 0)
  const uniqueCardsStudied = await countUniqueCardsStudiedAcrossSeries(supabase, userId, chapterIds)
  const averageAccuracy = calculateWeightedAverageAccuracy(chapterProgress)
  const totalTimeSpentSeconds = chapterProgress.reduce((sum, cp) => sum + (cp.time_spent_seconds || 0), 0)
  const currentStreak = calculateMaxStreak(chapterProgress)
  const lastStudied = getMostRecentLastStudied(chapterProgress)

  return {
    chaptersCompleted,
    totalCards,
    uniqueCardsStudied,
    averageAccuracy,
    totalTimeSpentSeconds,
    currentStreak,
    lastStudied
  }
}

/**
 * Counts unique cards studied across all chapters in series
 * Input: supabase client, user id, chapter ids
 * Output: number of unique cards studied
 */
async function countUniqueCardsStudiedAcrossSeries(
  supabase: DbClient,
  userId: string,
  chapterIds: string[]
): Promise<number> {
  const { data: decks, error: decksError } = await supabase
    .from('user_chapter_decks')
    .select('id')
    .eq('user_id', userId)
    .in('chapter_id', chapterIds)

  if (decksError) {
    logger.error({ userId, error: decksError.message, code: decksError.code }, 'Error fetching decks')
    throw decksError
  }

  if (!decks || decks.length === 0) {
    return 0
  }

  const deckIds = decks.map(d => d.id)
  const { data: cards, error: cardsError } = await supabase
    .from('user_deck_srs_cards')
    .select('vocabulary_id')
    .eq('user_id', userId)
    .in('deck_id', deckIds)
    .neq('state', 'New')

  if (cardsError) {
    logger.error({ userId, error: cardsError.message, code: cardsError.code }, 'Error fetching cards')
    throw cardsError
  }

  if (cards && cards.length > 0) {
    const uniqueVocabIds = new Set(cards.map(c => c.vocabulary_id))
    return uniqueVocabIds.size
  }

  return 0
}

/**
 * Calculates weighted average accuracy from chapter progress
 * Input: chapter progress array
 * Output: weighted average accuracy
 */
function calculateWeightedAverageAccuracy(
  chapterProgress: Database['public']['Tables']['user_chapter_progress_summary']['Row'][]
): number {
  const progressWithCards = chapterProgress.filter(cp => (cp.num_cards_studied || 0) > 0)
  
  if (progressWithCards.length === 0) {
    return 0
  }

  const totalWeightedAccuracy = progressWithCards.reduce((sum, cp) => {
    const cards = cp.num_cards_studied || 0
    const accuracy = cp.accuracy || 0
    return sum + (accuracy * cards)
  }, 0)
  
  const totalCardsForAccuracy = progressWithCards.reduce((sum, cp) => sum + (cp.num_cards_studied || 0), 0)
  
  return totalCardsForAccuracy > 0 ? totalWeightedAccuracy / totalCardsForAccuracy : 0
}

/**
 * Calculates max streak from chapter progress
 * Input: chapter progress array
 * Output: max streak value
 */
function calculateMaxStreak(
  chapterProgress: Database['public']['Tables']['user_chapter_progress_summary']['Row'][]
): number {
  if (chapterProgress.length === 0) {
    return 0
  }
  return Math.max(...chapterProgress.map(cp => cp.current_streak || 0))
}

/**
 * Gets most recent last_studied date from chapter progress
 * Input: chapter progress array
 * Output: most recent last_studied date or null
 */
function getMostRecentLastStudied(
  chapterProgress: Database['public']['Tables']['user_chapter_progress_summary']['Row'][]
): string | null {
  const lastStudiedDates = chapterProgress
    .map(cp => cp.last_studied)
    .filter((date): date is string => date !== null)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  
  return lastStudiedDates.length > 0 ? lastStudiedDates[0] : null
}

/**
 * Gets current series progress
 * Input: supabase client, user id, series id
 * Output: current progress or null
 */
async function getCurrentSeriesProgress(
  supabase: DbClient,
  userId: string,
  seriesId: string
) {
  const { data: currentProgress, error: fetchError } = await supabase
    .from('user_series_progress_summary')
    .select('*')
    .eq('user_id', userId)
    .eq('series_id', seriesId)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    logger.error({ userId, seriesId, error: fetchError.message, code: fetchError.code }, 'Error fetching series progress')
    throw fetchError
  }

  return currentProgress
}

/**
 * Updates existing series progress
 * Input: supabase client, user id, series id, total chapters, stats, timestamp
 * Output: void
 */
async function updateExistingSeriesProgress(
  supabase: DbClient,
  userId: string,
  seriesId: string,
  totalChaptersCount: number,
  stats: Awaited<ReturnType<typeof calculateSeriesStats>>,
  now: Date
): Promise<void> {
  const updateData: TablesUpdate<'user_series_progress_summary'> = {
    chapters_completed: stats.chaptersCompleted,
    total_chapters: totalChaptersCount,
    cards_studied: stats.uniqueCardsStudied,
    total_cards: stats.totalCards,
    average_accuracy: stats.averageAccuracy,
    total_time_spent_seconds: stats.totalTimeSpentSeconds,
    current_streak: stats.currentStreak,
    last_studied: stats.lastStudied,
    updated_at: now.toISOString()
  }

  const { error } = await supabase
    .from('user_series_progress_summary')
    .update(updateData)
    .eq('user_id', userId)
    .eq('series_id', seriesId)

  if (error) {
    logger.error({ userId, seriesId, error: error.message, code: error.code }, 'Error updating series progress')
    throw error
  }
  logger.info({ userId, seriesId, chaptersCompleted: stats.chaptersCompleted, totalChaptersCount, uniqueCardsStudied: stats.uniqueCardsStudied, totalCards: stats.totalCards, averageAccuracy: stats.averageAccuracy }, 'Series progress updated')
}

/**
 * Creates new series progress record
 * Input: supabase client, user id, series id, total chapters, stats
 * Output: void
 */
async function createNewSeriesProgress(
  supabase: DbClient,
  userId: string,
  seriesId: string,
  totalChaptersCount: number,
  stats: Awaited<ReturnType<typeof calculateSeriesStats>>
): Promise<void> {
  const insertData: TablesInsert<'user_series_progress_summary'> = {
    user_id: userId,
    series_id: seriesId,
    chapters_completed: stats.chaptersCompleted,
    total_chapters: totalChaptersCount,
    cards_studied: stats.uniqueCardsStudied,
    total_cards: stats.totalCards,
    average_accuracy: stats.averageAccuracy,
    total_time_spent_seconds: stats.totalTimeSpentSeconds,
    current_streak: stats.currentStreak,
    last_studied: stats.lastStudied
  }

  const { error } = await supabase
    .from('user_series_progress_summary')
    .insert(insertData)

  if (error) {
    logger.error({ userId, seriesId, error: error.message, code: error.code }, 'Error creating series progress')
    throw error
  }
  logger.info({ userId, seriesId, chaptersCompleted: stats.chaptersCompleted, totalChaptersCount, uniqueCardsStudied: stats.uniqueCardsStudied, totalCards: stats.totalCards, averageAccuracy: stats.averageAccuracy }, 'Series progress created')
}

