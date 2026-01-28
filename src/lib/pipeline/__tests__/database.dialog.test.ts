import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { OcrResult } from '@/lib/pipeline/types'

// Mock the Supabase client before importing functions
const mockUpsert = mock(() => Promise.resolve({ error: null }))
const mockSelect = mock(() => ({
  eq: mock(() => ({
    single: mock(() => Promise.resolve({
      data: { dialogue_text: 'test dialogue' },
      error: null
    }))
  }))
}))

const mockFrom = mock((table: string) => ({
  upsert: mockUpsert,
  select: mockSelect
}))

const mockSupabase = {
  from: mockFrom
}

mock.module('@/lib/supabase/server', () => ({
  createServiceRoleClient: () => mockSupabase
}))

// Import after mocking
import {
  storeChapterDialog,
  getChapterDialogue
} from '@/lib/pipeline/database'

describe('database.dialog', () => {
  beforeEach(() => {
    mockUpsert.mockClear()
    mockSelect.mockClear()
    mockFrom.mockClear()
  })

  describe('storeChapterDialog', () => {
    const sampleOcrResults: OcrResult[] = [
      { text: '안녕', bbox: { x: 10, y: 20, width: 50, height: 30 } },
      { text: '하세요', bbox: { x: 70, y: 20, width: 60, height: 30 } }
    ]

    it('stores dialogue text and OCR results', async () => {
      const dialogueText = '안녕하세요'
      const chapterId = 'test-chapter-id'

      await storeChapterDialog(dialogueText, sampleOcrResults, chapterId)

      expect(mockFrom).toHaveBeenCalledWith('chapter_dialog')
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          chapter_id: chapterId,
          dialogue_text: dialogueText,
          ocr_results: sampleOcrResults
        },
        { onConflict: 'chapter_id' }
      )
    })

    it('handles empty OCR results array', async () => {
      await storeChapterDialog('text', [], 'chapter-id')

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          ocr_results: []
        }),
        expect.any(Object)
      )
    })

    it('handles empty dialogue text', async () => {
      await storeChapterDialog('', sampleOcrResults, 'chapter-id')

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          dialogue_text: ''
        }),
        expect.any(Object)
      )
    })
  })

  describe('getChapterDialogue', () => {
    it('retrieves dialogue text by chapter id', async () => {
      const result = await getChapterDialogue('test-chapter-id')

      expect(mockFrom).toHaveBeenCalledWith('chapter_dialog')
      expect(result).toBe('test dialogue')
    })
  })

  describe('OcrResult structure', () => {
    it('has correct shape for storage', () => {
      const ocrResult: OcrResult = {
        text: '테스트',
        bbox: {
          x: 100,
          y: 200,
          width: 50,
          height: 25
        }
      }

      expect(ocrResult.text).toBe('테스트')
      expect(ocrResult.bbox.x).toBe(100)
      expect(ocrResult.bbox.y).toBe(200)
      expect(ocrResult.bbox.width).toBe(50)
      expect(ocrResult.bbox.height).toBe(25)
    })

    it('serializes to JSON correctly', () => {
      const ocrResults: OcrResult[] = [
        { text: 'word1', bbox: { x: 10, y: 20, width: 30, height: 40 } },
        { text: 'word2', bbox: { x: 50, y: 60, width: 70, height: 80 } }
      ]

      const json = JSON.stringify(ocrResults)
      const parsed = JSON.parse(json)

      expect(parsed).toEqual(ocrResults)
    })
  })
})
