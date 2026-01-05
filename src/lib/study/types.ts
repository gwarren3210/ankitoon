import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Tables } from '@/types/database.types'
import { FsrsCard } from '@/lib/study/fsrs'


export type DbClient = SupabaseClient<Database>

export interface StudyCard {
  srsCard: FsrsCard
  vocabulary: Tables<'vocabulary'>
  chapterExample: string | null
  globalExample: string | null
  srsCardId: string
}

export interface StudySessionData {
  deckId: string
  cardsStudied: number
  accuracy: number
  timeSpentSeconds: number
  startTime: Date
  endTime: Date
}

