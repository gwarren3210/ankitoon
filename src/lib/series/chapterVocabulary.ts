import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { ChapterVocabulary } from '@/types/series.types'

type DbClient = SupabaseClient<Database>

type ChapterVocabularyRow = {
  vocabulary_id: string
  importance_score: number
  vocabulary: {
    id: string
    term: string
    definition: string
    example: string | null
    sense_key: string
  } | null
}

/**
 * Gets vocabulary for a chapter with full vocabulary details and card states.
 * Input: supabase client, chapter id, optional user id
 * Output: Array of chapter vocabulary with full details and card states
 */
export async function getChapterVocabulary(
  supabase: DbClient,
  chapterId: string,
  userId?: string
): Promise<ChapterVocabulary[]> {
  const { data, error } = await supabase
    .from('chapter_vocabulary')
    .select(`
      vocabulary_id,
      importance_score,
      vocabulary (
        id,
        term,
        definition,
        example,
        sense_key
      )
    `)
    .eq('chapter_id', chapterId)
    .order('importance_score', { ascending: false })

  if (error) {
    throw error
  }

  const vocabulary = (data || []).map((item: ChapterVocabularyRow) => {
    const vocab = item.vocabulary
    return {
      vocabularyId: item.vocabulary_id,
      term: vocab?.term || '',
      definition: vocab?.definition || '',
      senseKey: vocab?.sense_key || '',
      example: vocab?.example || null,
      importanceScore: item.importance_score
    }
  })

  // If user is provided, fetch card states
  if (userId) {
    // Get deck for this chapter
    const { data: deck } = await supabase
      .from('user_chapter_decks')
      .select('id')
      .eq('user_id', userId)
      .eq('chapter_id', chapterId)
      .single()

    if (deck) {
      // Get card states for all vocabulary in this chapter
      const vocabularyIds = vocabulary.map(v => v.vocabularyId)
      const { data: cards } = await supabase
        .from('user_deck_srs_cards')
        .select(`
          vocabulary_id,
          state,
          last_reviewed_date,
          due,
          total_reviews,
          streak_correct,
          streak_incorrect,
          stability,
          difficulty,
          first_seen_date,
          scheduled_days
        `)
        .eq('user_id', userId)
        .eq('deck_id', deck.id)
        .in('vocabulary_id', vocabularyIds)

      // Create map of vocabulary_id to card state
      const cardStateMap = new Map<string, {
        state: 'New' | 'Learning' | 'Review' | 'Relearning'
        lastStudied: string | null
        nextDue: string | null
        totalReviews: number
        streakCorrect: number
        streakIncorrect: number
        stability: number
        difficulty: number
        firstSeenDate: string | null
        scheduledDays: number | null
      }>()

      for (const card of cards || []) {
        cardStateMap.set(card.vocabulary_id, {
          state: card.state as 'New' | 'Learning' | 'Review' | 'Relearning',
          lastStudied: card.last_reviewed_date,
          nextDue: card.due,
          totalReviews: card.total_reviews,
          streakCorrect: card.streak_correct,
          streakIncorrect: card.streak_incorrect,
          stability: card.stability,
          difficulty: card.difficulty,
          firstSeenDate: card.first_seen_date,
          scheduledDays: card.scheduled_days
        })
      }

      // Merge card states with vocabulary
      return vocabulary.map(vocab => {
        const cardData = cardStateMap.get(vocab.vocabularyId)
        return {
          ...vocab,
          isStudied: cardData ? cardData.state !== 'New' : false,
          cardState: cardData?.state || 'New',
          lastStudied: cardData?.lastStudied || null,
          nextDue: cardData?.nextDue || null,
          totalReviews: cardData?.totalReviews || 0,
          streakCorrect: cardData?.streakCorrect || 0,
          streakIncorrect: cardData?.streakIncorrect || 0,
          stability: cardData?.stability,
          difficulty: cardData?.difficulty,
          firstSeenDate: cardData?.firstSeenDate || null,
          scheduledDays: cardData?.scheduledDays || null
        }
      })
    }
  }

  return vocabulary
}

