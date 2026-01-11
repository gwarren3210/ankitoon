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

type RpcResult =
  Database['public']['Functions']['get_user_library_decks']['Returns'][number]

/**
 * Gets all chapters with progress for a user (library deck entries).
 * Input: supabase client, user id
 * Output: Array of library deck entries (chapter + series + progress + due counts)
 */
export async function getUserLibraryDecks(
  supabase: DbClient,
  userId: string
): Promise<LibraryDeck[]> {
  const { data, error } = await supabase.rpc('get_user_library_decks', {
    p_user_id: userId
  })

  if (error) {
    throw error
  }

  if (!data || data.length === 0) {
    return []
  }

  return transformRpcResultToLibraryDecks(data, userId)
}

/**
 * Transforms RPC result rows into LibraryDeck format.
 * Input: Array of RPC result rows, user ID
 * Output: Array of LibraryDeck objects with nested chapter/series/progress
 */
function transformRpcResultToLibraryDecks(
  data: RpcResult[],
  userId: string
): LibraryDeck[] {
  return data.map(row => ({
    chapter: {
      id: row.chapter_id,
      series_id: row.chapter_series_id,
      chapter_number: row.chapter_number,
      title: row.chapter_title,
      external_url: row.chapter_external_url,
      created_at: row.chapter_created_at
    },
    series: {
      id: row.series_id,
      name: row.series_name,
      korean_name: row.series_korean_name,
      alt_names: row.series_alt_names,
      slug: row.series_slug,
      picture_url: row.series_picture_url,
      synopsis: row.series_synopsis,
      popularity: row.series_popularity,
      genres: row.series_genres,
      authors: row.series_authors,
      num_chapters: row.series_num_chapters,
      created_at: row.series_created_at,
      updated_at: row.series_updated_at
    },
    progress: {
      id: row.progress_id,
      user_id: userId,
      series_id: row.series_id,
      chapter_id: row.chapter_id,
      accuracy: row.progress_accuracy,
      num_cards_studied: row.progress_num_cards_studied,
      total_cards: row.progress_total_cards,
      unique_vocab_seen: row.progress_unique_vocab_seen,
      completed: row.progress_completed,
      current_streak: row.progress_current_streak,
      time_spent_seconds: row.progress_time_spent_seconds,
      first_studied: row.progress_first_studied,
      last_studied: row.progress_last_studied,
      created_at: null,
      updated_at: null
    },
    dueNow: row.due_now,
    dueLaterToday: row.due_later_today
  }))
}
