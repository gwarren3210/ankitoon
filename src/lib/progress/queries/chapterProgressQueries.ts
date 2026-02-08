import { createClient } from '@/lib/supabase/server'
import { Tables } from '@/types/database.types'

/**
 * Gets chapter progress for a user.
 * Input: user id, chapter id
 * Output: Chapter progress data or null if user hasn't studied this chapter
 */
export async function getChapterProgress(
  userId: string,
  chapterId: string
): Promise<Tables<'user_chapter_progress_summary'> | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_chapter_progress_summary')
    .select('*')
    .eq('user_id', userId)
    .eq('chapter_id', chapterId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw error
  }

  return data
}

/**
 * Gets progress for multiple chapters in batch.
 * Input: user id, array of chapter ids
 * Output: Map of chapter id to progress data
 */
export async function getChapterProgressBatch(
  userId: string,
  chapterIds: string[]
): Promise<Map<string, Tables<'user_chapter_progress_summary'>>> {
  if (chapterIds.length === 0) {
    return new Map()
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_chapter_progress_summary')
    .select('*')
    .eq('user_id', userId)
    .in('chapter_id', chapterIds)

  if (error) {
    throw error
  }

  const progressMap = new Map<string, Tables<'user_chapter_progress_summary'>>()
  for (const progress of data || []) {
    progressMap.set(progress.chapter_id, progress)
  }

  return progressMap
}

/**
 * Gets all chapter progress for a user in a specific series.
 * Input: user id, series id
 * Output: Array of chapter progress records
 */
export async function getChapterProgressBySeriesId(
  userId: string,
  seriesId: string
): Promise<Tables<'user_chapter_progress_summary'>[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_chapter_progress_summary')
    .select('*')
    .eq('user_id', userId)
    .eq('series_id', seriesId)

  if (error) {
    throw error
  }

  return data || []
}

/**
 * Counts cards in 'New' state for a specific chapter.
 * Input: user id, chapter id
 * Output: Count of new cards (not yet learned)
 */
export async function getNewCardCount(
  userId: string,
  chapterId: string
): Promise<number> {
  const supabase = await createClient()

  // First get the deck id for this chapter
  const { data: deck, error: deckError } = await supabase
    .from('user_chapter_decks')
    .select('id')
    .eq('user_id', userId)
    .eq('chapter_id', chapterId)
    .single()

  if (deckError) {
    if (deckError.code === 'PGRST116') {
      // No deck exists - all cards are effectively "new"
      // Count vocabulary in chapter
      const { count } = await supabase
        .from('chapter_vocabulary')
        .select('*', { count: 'exact', head: true })
        .eq('chapter_id', chapterId)
      return count || 0
    }
    throw deckError
  }

  // Count cards with state = 'New'
  const { count, error } = await supabase
    .from('user_deck_srs_cards')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('deck_id', deck.id)
    .eq('state', 'New')

  if (error) {
    throw error
  }

  return count || 0
}

/**
 * Counts cards that are due for review in a specific chapter.
 * Input: user id, chapter id
 * Output: Count of due cards (Learning, Review, or Relearning with due <= now)
 */
export async function getDueCardCount(
  userId: string,
  chapterId: string
): Promise<number> {
  const supabase = await createClient()

  // First get the deck id for this chapter
  const { data: deck, error: deckError } = await supabase
    .from('user_chapter_decks')
    .select('id')
    .eq('user_id', userId)
    .eq('chapter_id', chapterId)
    .single()

  if (deckError) {
    if (deckError.code === 'PGRST116') {
      // No deck exists - no cards are due
      return 0
    }
    throw deckError
  }

  // Count cards that are due (not New, and due date is now or past)
  const { count, error } = await supabase
    .from('user_deck_srs_cards')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('deck_id', deck.id)
    .neq('state', 'New')
    .lte('due', new Date().toISOString())

  if (error) {
    throw error
  }

  return count || 0
}

export interface ChapterCardCounts {
  newCount: number
  dueCount: number
}

/**
 * Gets both new and due card counts for a chapter in a single call.
 * Input: user id, chapter id
 * Output: Object with newCount and dueCount
 */
export async function getChapterCardCounts(
  userId: string,
  chapterId: string
): Promise<ChapterCardCounts> {
  const [newCount, dueCount] = await Promise.all([
    getNewCardCount(userId, chapterId),
    getDueCardCount(userId, chapterId)
  ])

  return { newCount, dueCount }
}

/**
 * Gets card counts for multiple chapters in batch.
 * More efficient than calling getChapterCardCounts for each chapter.
 * Input: user id, array of chapter ids
 * Output: Map of chapter id to ChapterCardCounts
 */
export async function getChapterCardCountsBatch(
  userId: string,
  chapterIds: string[]
): Promise<Map<string, ChapterCardCounts>> {
  if (chapterIds.length === 0) {
    return new Map()
  }

  const supabase = await createClient()

  // Get all decks for these chapters
  const { data: decks, error: decksError } = await supabase
    .from('user_chapter_decks')
    .select('id, chapter_id')
    .eq('user_id', userId)
    .in('chapter_id', chapterIds)

  if (decksError) {
    throw decksError
  }

  // Create map of chapterId -> deckId
  const chapterToDeck = new Map<string, string>()
  const deckIds: string[] = []
  for (const deck of decks || []) {
    chapterToDeck.set(deck.chapter_id, deck.id)
    deckIds.push(deck.id)
  }

  // Initialize results with zeros for all chapters
  const results = new Map<string, ChapterCardCounts>()
  for (const chapterId of chapterIds) {
    results.set(chapterId, { newCount: 0, dueCount: 0 })
  }

  if (deckIds.length === 0) {
    return results
  }

  // Get all SRS cards for these decks in one query
  const { data: cards, error: cardsError } = await supabase
    .from('user_deck_srs_cards')
    .select('deck_id, state, due')
    .eq('user_id', userId)
    .in('deck_id', deckIds)

  if (cardsError) {
    throw cardsError
  }

  // Create reverse map: deckId -> chapterId
  const deckToChapter = new Map<string, string>()
  for (const [chapterId, deckId] of chapterToDeck) {
    deckToChapter.set(deckId, chapterId)
  }

  // Count new and due cards per chapter
  const now = new Date()
  for (const card of cards || []) {
    const chapterId = deckToChapter.get(card.deck_id)
    if (!chapterId) continue

    const counts = results.get(chapterId)!

    if (card.state === 'New') {
      counts.newCount++
    } else if (card.due && new Date(card.due) <= now) {
      counts.dueCount++
    }
  }

  return results
}
