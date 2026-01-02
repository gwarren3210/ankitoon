import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Tables } from '@/types/database.types'

type DbClient = SupabaseClient<Database>

export type LibraryDeck = {
  chapter: Tables<'chapters'>
  series: Tables<'series'>
  progress: Tables<'user_chapter_progress_summary'>
  dueNow: number
  dueLaterToday: number
}

/**
 * Gets all chapters with progress for a user (library deck entries).
 * Input: supabase client, user id
 * Output: Array of library deck entries (chapter + series + progress)
 * TODO: function bad implementation
 */
export async function getUserLibraryDecks(
  supabase: DbClient,
  userId: string
): Promise<LibraryDeck[]> {
  const { data: progressData, error: progressError } = await supabase
    .from('user_chapter_progress_summary')
    .select('*')
    .eq('user_id', userId)

  if (progressError) {
    throw progressError
  }

  if (!progressData || progressData.length === 0) {
    return []
  }

  // Get unique chapter and series IDs
  const chapterIds = [...new Set(progressData.map(p => p.chapter_id))]
  const seriesIds = [...new Set(progressData.map(p => p.series_id))]

  // Fetch chapters and series in parallel
  const [chaptersResult, seriesResult] = await Promise.all([
    supabase
      .from('chapters')
      .select('*')
      .in('id', chapterIds),
    supabase
      .from('series')
      .select('*')
      .in('id', seriesIds)
  ])

  if (chaptersResult.error) {
    throw chaptersResult.error
  }

  if (seriesResult.error) {
    throw seriesResult.error
  }

  // Create maps for quick lookup
  const chaptersMap = new Map(
    (chaptersResult.data || []).map(ch => [ch.id, ch])
  )
  const seriesMap = new Map(
    (seriesResult.data || []).map(s => [s.id, s])
  )

  // Get all deck IDs for these chapters
  const { data: decksData, error: decksError } = await supabase
    .from('user_chapter_decks')
    .select('id, chapter_id')
    .eq('user_id', userId)
    .in('chapter_id', chapterIds)
    .not('chapter_id', 'is', null)

  if (decksError) {
    throw decksError
  }

  const deckIds = (decksData || []).map(d => d.id)
  const chapterToDecksMap = new Map<string, string[]>()
  
  for (const deck of decksData || []) {
    if (!deck.chapter_id) continue
    const existing = chapterToDecksMap.get(deck.chapter_id) || []
    chapterToDecksMap.set(deck.chapter_id, [...existing, deck.id])
  }

  // Get due card counts if we have decks
  const now = new Date()
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)

  const dueCountsMap = new Map<string, { dueNow: number, dueLaterToday: number }>()
  
  if (deckIds.length > 0) {
    // Get all due cards to count per deck
    const { data: allDueCards, error: allDueError } = await supabase
      .from('user_deck_srs_cards')
      .select('deck_id, due, state')
      .in('deck_id', deckIds)
      .not('due', 'is', null)
      .neq('state', 'New')

    if (allDueError) {
      throw allDueError
    }

    // Group by deck and count
    const deckDueCounts = new Map<string, { dueNow: number, dueLaterToday: number }>()
    
    for (const deck of decksData || []) {
      if (!deck.chapter_id) continue
      deckDueCounts.set(deck.id, { dueNow: 0, dueLaterToday: 0 })
    }

    for (const card of allDueCards || []) {
      if (!card.due) continue
      
      const cardDue = new Date(card.due)
      const counts = deckDueCounts.get(card.deck_id)
      if (!counts) continue

      if (cardDue <= now) {
        counts.dueNow++
      } else if (cardDue <= endOfToday) {
        counts.dueLaterToday++
      }
    }

    // Aggregate by chapter
    for (const [chapterId, deckIdsForChapter] of chapterToDecksMap.entries()) {
      let dueNow = 0
      let dueLaterToday = 0
      
      for (const deckId of deckIdsForChapter) {
        const counts = deckDueCounts.get(deckId)
        if (counts) {
          dueNow += counts.dueNow
          dueLaterToday += counts.dueLaterToday
        }
      }
      
      dueCountsMap.set(chapterId, { dueNow, dueLaterToday })
    }
  }

  // Combine data
  return progressData
    .map(progress => {
      const chapter = chaptersMap.get(progress.chapter_id)
      const series = seriesMap.get(progress.series_id)

      if (!chapter || !series) {
        return null
      }

      const dueCounts = dueCountsMap.get(progress.chapter_id) || { dueNow: 0, dueLaterToday: 0 }

      return {
        chapter,
        series,
        progress,
        dueNow: dueCounts.dueNow,
        dueLaterToday: dueCounts.dueLaterToday
      }
    })
    .filter((deck): deck is LibraryDeck => deck !== null)
}

