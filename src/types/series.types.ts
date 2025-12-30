import { Tables } from '@/types/database.types'

export type SeriesWithProgress = Tables<'series'> & {
  chaptersCompleted: number
  totalChapters: number
  userProgress?: Tables<'user_series_progress_summary'>
}

export type ChapterWithVocab = Tables<'chapters'> & {
  vocabularyCount: number
  progress?: Tables<'user_chapter_progress_summary'>
}

export type ChapterVocabulary = {
  vocabularyId: string
  term: string
  definition: string
  senseKey: string
  example: string | null
  importanceScore: number
  isStudied?: boolean
  cardState?: 'New' | 'Learning' | 'Review' | 'Relearning'
  lastStudied?: string | null
  accuracy?: number | null
  nextDue?: string | null
}

export type VocabStats = {
  totalVocabulary: number
  uniqueTerms: number
  averageImportance: number
}

