import { describe, it, expect } from 'bun:test'
import { groupOcrIntoLines } from '@/lib/pipeline/textGrouper'
import { OcrResult } from '@/lib/pipeline/types'

describe('textGrouper', () => {
  describe('groupOcrIntoLines', () => {
    it('returns empty array for empty input', () => {
      const result = groupOcrIntoLines([])
      expect(result).toEqual([])
    })

    it('groups single item into one line', () => {
      const input: OcrResult[] = [
        { text: 'hello', bbox: { x: 10, y: 20, width: 50, height: 30 } }
      ]

      const result = groupOcrIntoLines(input)

      expect(result).toHaveLength(1)
      expect(result[0].line).toBe('hello')
      expect(result[0].bbox).toEqual({ x: 10, y: 20, width: 50, height: 30 })
    })

    it('groups items within vertical threshold', () => {
      const input: OcrResult[] = [
        { text: 'word1', bbox: { x: 10, y: 100, width: 50, height: 30 } },
        { text: 'word2', bbox: { x: 70, y: 110, width: 50, height: 30 } },
        { text: 'word3', bbox: { x: 130, y: 105, width: 50, height: 30 } }
      ]

      const result = groupOcrIntoLines(input, 50)

      expect(result).toHaveLength(1)
      expect(result[0].line).toContain('word1')
      expect(result[0].line).toContain('word2')
      expect(result[0].line).toContain('word3')
    })

    it('separates items beyond vertical threshold', () => {
      const input: OcrResult[] = [
        { text: 'bubble1', bbox: { x: 10, y: 100, width: 50, height: 30 } },
        { text: 'bubble2', bbox: { x: 10, y: 300, width: 50, height: 30 } }
      ]

      const result = groupOcrIntoLines(input, 50)

      expect(result).toHaveLength(2)
      expect(result[0].line).toBe('bubble1')
      expect(result[1].line).toBe('bubble2')
    })

    it('creates multiple groups for multiple speech bubbles', () => {
      const input: OcrResult[] = [
        // First bubble
        { text: 'Hello', bbox: { x: 10, y: 100, width: 40, height: 20 } },
        { text: 'there', bbox: { x: 60, y: 100, width: 40, height: 20 } },
        // Second bubble (200px gap)
        { text: 'How', bbox: { x: 10, y: 350, width: 30, height: 20 } },
        { text: 'are', bbox: { x: 50, y: 350, width: 25, height: 20 } },
        { text: 'you', bbox: { x: 85, y: 350, width: 30, height: 20 } }
      ]

      const result = groupOcrIntoLines(input, 100)

      expect(result).toHaveLength(2)
      expect(result[0].line).toBe('Hello there')
      expect(result[1].line).toBe('How are you')
    })

    it('uses default threshold of 100', () => {
      const input: OcrResult[] = [
        { text: 'close', bbox: { x: 10, y: 100, width: 40, height: 20 } },
        { text: 'enough', bbox: { x: 10, y: 180, width: 50, height: 20 } }
      ]

      const result = groupOcrIntoLines(input)

      expect(result).toHaveLength(1)
    })

    it('respects custom threshold', () => {
      const input: OcrResult[] = [
        { text: 'word1', bbox: { x: 10, y: 100, width: 40, height: 20 } },
        { text: 'word2', bbox: { x: 10, y: 130, width: 50, height: 20 } }
      ]

      // Should be separate with threshold of 20
      const result = groupOcrIntoLines(input, 20)
      expect(result).toHaveLength(2)

      // Should be grouped with threshold of 50
      const result2 = groupOcrIntoLines(input, 50)
      expect(result2).toHaveLength(1)
    })
  })

  describe('text ordering', () => {
    it('sorts horizontally for same-line items', () => {
      const input: OcrResult[] = [
        { text: 'third', bbox: { x: 200, y: 100, width: 40, height: 20 } },
        { text: 'first', bbox: { x: 10, y: 100, width: 40, height: 20 } },
        { text: 'second', bbox: { x: 100, y: 100, width: 40, height: 20 } }
      ]

      const result = groupOcrIntoLines(input)

      expect(result[0].line).toBe('first second third')
    })

    it('handles slight vertical variance on same line', () => {
      const input: OcrResult[] = [
        { text: 'B', bbox: { x: 60, y: 102, width: 20, height: 20 } },
        { text: 'A', bbox: { x: 10, y: 100, width: 20, height: 20 } },
        { text: 'C', bbox: { x: 110, y: 98, width: 20, height: 20 } }
      ]

      const result = groupOcrIntoLines(input)

      expect(result[0].line).toBe('A B C')
    })

    it('sorts vertically then horizontally for multi-line groups', () => {
      const input: OcrResult[] = [
        { text: 'line2-word1', bbox: { x: 10, y: 140, width: 80, height: 20 } },
        { text: 'line1-word2', bbox: { x: 100, y: 100, width: 80, height: 20 } },
        { text: 'line1-word1', bbox: { x: 10, y: 100, width: 80, height: 20 } },
        { text: 'line2-word2', bbox: { x: 100, y: 140, width: 80, height: 20 } }
      ]

      const result = groupOcrIntoLines(input)

      expect(result[0].line).toBe(
        'line1-word1 line1-word2 line2-word1 line2-word2'
      )
    })
  })

  describe('combined bounding box', () => {
    it('calculates bbox encompassing all items', () => {
      const input: OcrResult[] = [
        { text: 'A', bbox: { x: 10, y: 20, width: 30, height: 25 } },
        { text: 'B', bbox: { x: 50, y: 30, width: 40, height: 20 } }
      ]

      const result = groupOcrIntoLines(input)

      expect(result[0].bbox).toEqual({
        x: 10,
        y: 20,
        width: 80, // 90 - 10
        height: 30 // 50 - 20
      })
    })

    it('handles single item bbox correctly', () => {
      const input: OcrResult[] = [
        { text: 'single', bbox: { x: 100, y: 200, width: 50, height: 25 } }
      ]

      const result = groupOcrIntoLines(input)

      expect(result[0].bbox).toEqual({
        x: 100,
        y: 200,
        width: 50,
        height: 25
      })
    })

    it('each group has its own bounding box', () => {
      const input: OcrResult[] = [
        { text: 'top', bbox: { x: 10, y: 50, width: 30, height: 20 } },
        { text: 'bottom', bbox: { x: 10, y: 300, width: 50, height: 25 } }
      ]

      const result = groupOcrIntoLines(input, 50)

      expect(result).toHaveLength(2)
      expect(result[0].bbox.y).toBe(50)
      expect(result[1].bbox.y).toBe(300)
    })
  })

  describe('edge cases', () => {
    it('handles unsorted input', () => {
      const input: OcrResult[] = [
        { text: 'last', bbox: { x: 10, y: 500, width: 30, height: 20 } },
        { text: 'first', bbox: { x: 10, y: 100, width: 30, height: 20 } },
        { text: 'middle', bbox: { x: 10, y: 300, width: 30, height: 20 } }
      ]

      const result = groupOcrIntoLines(input, 50)

      expect(result).toHaveLength(3)
      expect(result[0].line).toBe('first')
      expect(result[1].line).toBe('middle')
      expect(result[2].line).toBe('last')
    })

    it('handles items at exact threshold distance', () => {
      const input: OcrResult[] = [
        { text: 'A', bbox: { x: 10, y: 100, width: 20, height: 20 } },
        { text: 'B', bbox: { x: 10, y: 150, width: 20, height: 20 } }
      ]

      // Exactly at threshold should be grouped
      const result = groupOcrIntoLines(input, 50)
      expect(result).toHaveLength(1)
    })

    it('handles items just beyond threshold', () => {
      const input: OcrResult[] = [
        { text: 'A', bbox: { x: 10, y: 100, width: 20, height: 20 } },
        { text: 'B', bbox: { x: 10, y: 151, width: 20, height: 20 } }
      ]

      const result = groupOcrIntoLines(input, 50)
      expect(result).toHaveLength(2)
    })

    it('handles negative coordinates', () => {
      const input: OcrResult[] = [
        { text: 'neg', bbox: { x: -10, y: -20, width: 30, height: 20 } },
        { text: 'pos', bbox: { x: 50, y: -15, width: 30, height: 20 } }
      ]

      const result = groupOcrIntoLines(input)

      expect(result).toHaveLength(1)
      expect(result[0].bbox.x).toBe(-10)
      expect(result[0].bbox.y).toBe(-20)
    })

    it('preserves text with special characters', () => {
      const input: OcrResult[] = [
        { text: '안녕', bbox: { x: 10, y: 100, width: 30, height: 20 } },
        { text: '하세요!', bbox: { x: 50, y: 100, width: 40, height: 20 } }
      ]

      const result = groupOcrIntoLines(input)

      expect(result[0].line).toBe('안녕 하세요!')
    })
  })
})

