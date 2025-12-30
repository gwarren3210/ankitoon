import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Tables } from '@/types/database.types'
import { Card } from 'ts-fsrs'

export type DbClient = SupabaseClient<Database>

export interface StudyCard {
  srsCard: Card
  vocabulary: Tables<'vocabulary'>
}

export interface StudySessionData {
  deckId: string
  cardsStudied: number
  accuracy: number
  timeSpentSeconds: number
  startTime: Date
  endTime: Date
}

