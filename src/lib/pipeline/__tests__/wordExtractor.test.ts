import { describe, it, expect, beforeEach, beforeAll, mock } from 'bun:test'
import { readFile } from 'fs/promises'
import { join } from 'path'

const TEST_DATA_DIR = join(__dirname, 'test-data')

// Mock the GoogleGenAI class
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGenerateContent = mock((_opts: any) => Promise.resolve({}))

mock.module('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerateContent }
  },
  Type: {
    ARRAY: 'array',
    OBJECT: 'object',
    STRING: 'string',
    NUMBER: 'number'
  }
}))

const { extractWords } = await import('@/lib/pipeline/wordExtractor')

describe('wordExtractor', () => {
  beforeEach(() => {
    mockGenerateContent.mockClear()
  })

  describe('extractWords', () => {
    it('throws error when API key not configured', async () => {
      await expect(
        extractWords('test dialogue', { apiKey: '' })
      ).rejects.toThrow('GEMINI_API_KEY not configured')
    })

    it('returns empty array for empty dialogue', async () => {
      const result = await extractWords('', { apiKey: 'test-key' })
      expect(result).toEqual([])
    })

    it('returns empty array for whitespace-only dialogue', async () => {
      const result = await extractWords('   ', { apiKey: 'test-key' })
      expect(result).toEqual([])
    })

    it('extracts words from Korean dialogue', async () => {
      const mockWords = [
        { korean: '헌터', english: 'hunter', importanceScore: 95 },
        { korean: '협회', english: 'association', importanceScore: 75 }
      ]

      mockGenerateContent.mockResolvedValueOnce({
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify(mockWords) }]
          }
        }]
      })

      const result = await extractWords('내 이름은 성진우', { apiKey: 'test-key' })

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        korean: '헌터',
        english: 'hunter',
        importanceScore: 95
      })
    })

    it('calls Gemini API with correct parameters', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [{
          content: { parts: [{ text: '[]' }] }
        }]
      })

      await extractWords('테스트', { apiKey: 'test-key' })

      expect(mockGenerateContent).toHaveBeenCalledTimes(1)
      const callArgs = mockGenerateContent.mock.calls[0]![0]
      expect(callArgs.model).toBe('gemini-2.5-flash')
      expect(callArgs.config.responseMimeType).toBe('application/json')
    })

    it('uses custom model when provided', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [{
          content: { parts: [{ text: '[]' }] }
        }]
      })

      await extractWords('테스트', {
        apiKey: 'test-key',
        model: 'gemini-2.0-flash'
      })

      const callArgs = mockGenerateContent.mock.calls[0]![0]
      expect(callArgs.model).toBe('gemini-2.0-flash')
    })

    it('handles invalid API response', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        candidates: []
      })

      await expect(
        extractWords('테스트', { apiKey: 'test-key' })
      ).rejects.toThrow('Invalid response from Gemini API')
    })

    it('filters out invalid words from response', async () => {
      const mockWords = [
        { korean: '헌터', english: 'hunter', importanceScore: 95 },
        { korean: '', english: 'invalid', importanceScore: 50 },
        { korean: '협회', english: '', importanceScore: 75 },
        { korean: '계급', english: 'rank', importanceScore: 85 }
      ]

      mockGenerateContent.mockResolvedValueOnce({
        candidates: [{
          content: { parts: [{ text: JSON.stringify(mockWords) }] }
        }]
      })

      const result = await extractWords('테스트', { apiKey: 'test-key' })

      expect(result).toHaveLength(2)
      expect(result[0].korean).toBe('헌터')
      expect(result[1].korean).toBe('계급')
    })
  })

  describe('integration with real test data', () => {
    let processedWords: { words: Array<{
      korean: string
      english: string
      importanceScore: number
    }> }

    beforeAll(async () => {
      const wordsPath = join(TEST_DATA_DIR, 'processed-words.json')
      processedWords = JSON.parse(await readFile(wordsPath, 'utf-8'))
    })

    it('response format matches expected structure', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify(processedWords.words) }]
          }
        }]
      })

      const result = await extractWords('테스트', { apiKey: 'test-key' })

      expect(result.length).toBeGreaterThan(0)
      result.forEach(word => {
        expect(word).toHaveProperty('korean')
        expect(word).toHaveProperty('english')
        expect(word).toHaveProperty('importanceScore')
        expect(typeof word.korean).toBe('string')
        expect(typeof word.english).toBe('string')
        expect(typeof word.importanceScore).toBe('number')
      })
    })

    it('parses Solo Leveling vocabulary correctly', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify(processedWords.words) }]
          }
        }]
      })

      const result = await extractWords('테스트', { apiKey: 'test-key' })

      // Check for expected Solo Leveling words
      const hunterWord = result.find(w => w.korean === '헌터')
      expect(hunterWord).toBeDefined()
      expect(hunterWord!.english).toBe('hunter')

      const dungeonWord = result.find(w => w.korean === '던전')
      expect(dungeonWord).toBeDefined()
      expect(dungeonWord!.english).toBe('dungeon')
    })

    it('importance scores are in valid range', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        candidates: [{
          content: {
            parts: [{ text: JSON.stringify(processedWords.words) }]
          }
        }]
      })

      const result = await extractWords('테스트', { apiKey: 'test-key' })

      result.forEach(word => {
        expect(word.importanceScore).toBeGreaterThanOrEqual(0)
        expect(word.importanceScore).toBeLessThanOrEqual(100)
      })
    })
  })
})

