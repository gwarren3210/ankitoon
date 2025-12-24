import { describe, it, expect, beforeEach, beforeAll, mock } from 'bun:test'
import { readFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'

const TEST_DATA_DIR = join(__dirname, 'test-data')

// Mock fetch globally with proper typing
type FetchArgs = [input: RequestInfo | URL, init?: RequestInit]
let mockResponses: object[] = []
let mockResponseIndex = 0
let shouldReject = false
let rejectError: Error | null = null

const mockFetch = mock<(...args: FetchArgs) => Promise<Response>>(
  (input: RequestInfo | URL) => {
    // Only handle OCR API calls, return empty for debug logs
    if (!String(input).includes('ocr.space')) {
      return Promise.resolve(new Response('{}'))
    }

    if (shouldReject && rejectError) {
      return Promise.reject(rejectError)
    }

    const data = mockResponses[mockResponseIndex] || mockResponses[0] || {}
    mockResponseIndex++
    return Promise.resolve(new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))
  }
)

/**
 * Sets mock responses for OCR API calls. Resets index on each call.
 * Input: array of response objects or single object
 * Output: void
 */
function setMockResponses(data: object | object[]): void {
  mockResponses = Array.isArray(data) ? data : [data]
  mockResponseIndex = 0
  shouldReject = false
  rejectError = null
}

/**
 * Sets the mock to reject with an error.
 * Input: error to reject with
 * Output: void
 */
function setMockReject(error: Error): void {
  shouldReject = true
  rejectError = error
}

// Mock fs functions
const mockWriteFile = mock(() => Promise.resolve())
const mockUnlink = mock(() => Promise.resolve())
const mockStat = mock(() => Promise.resolve({ size: 1000 }))

mock.module('fs', () => ({
  promises: {
    writeFile: mockWriteFile,
    unlink: mockUnlink,
    stat: mockStat,
    readFile: async () => {
      // Return buffer for temp file reads (for base64 conversion)
      return Buffer.from('test-image-data')
    }
  }
}))

// Store original fetch and replace with mock
beforeEach(() => {
  globalThis.fetch = mockFetch as unknown as typeof fetch
})

// Import AFTER mocks are set up
const { processImage } = await import('@/lib/pipeline/ocr')

describe('ocr', () => {
  let smallImageBuffer: Buffer
  let largeImageBuffer: Buffer

  beforeAll(async () => {
    smallImageBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    })
      .jpeg()
      .toBuffer()

    // Large image - use PNG for larger file size
    largeImageBuffer = await sharp({
      create: {
        width: 4000,
        height: 6000,
        channels: 3,
        background: { r: 128, g: 128, b: 128 }
      }
    })
      .png()
      .toBuffer()
  })

  beforeEach(() => {
    mockFetch.mockClear()
    mockWriteFile.mockClear()
    mockUnlink.mockClear()
    mockStat.mockClear()
    mockResponses = []
    mockResponseIndex = 0
    shouldReject = false
    rejectError = null
  })

  describe('processImage', () => {
    it('throws error when API key not configured', async () => {
      await expect(
        processImage(smallImageBuffer, { apiKey: '' })
      ).rejects.toThrow('OCR_API_KEY not configured')
    })

    it('processes small images without tiling', async () => {
      setMockResponses({
        OCRExitCode: 1,
        ParsedResults: [
          {
            TextOverlay: {
              Lines: [
                {
                  Words: [
                    {
                      WordText: '안녕',
                      Left: 10,
                      Top: 20,
                      Width: 50,
                      Height: 30
                    }
                  ]
                }
              ]
            }
          }
        ]
      })

      const results = await processImage(smallImageBuffer, {
        apiKey: 'test-key'
      })

      expect(results).toHaveLength(1)
      expect(results[0]).toEqual({
        text: '안녕',
        bbox: { x: 10, y: 20, width: 50, height: 30 }
      })
      const ocrCalls = mockFetch.mock.calls.filter(
        call => String(call[0]).includes('ocr.space')
      )
      expect(ocrCalls.length).toBe(1)
    })

    it('processes large images with tiling', async () => {
      setMockResponses({
        OCRExitCode: 1,
        ParsedResults: [
          {
            TextOverlay: {
              Lines: [
                {
                  Words: [
                    {
                      WordText: '한글',
                      Left: 100,
                      Top: 50,
                      Width: 60,
                      Height: 40
                    }
                  ]
                }
              ]
            }
          }
        ]
      })

      const results = await processImage(largeImageBuffer, {
        apiKey: 'test-key',
        fileSizeThreshold: 20 * 1024 // Force tiling with low threshold
      })

      expect(results.length).toBeGreaterThan(0)
      const ocrCalls = mockFetch.mock.calls.filter(
        call => String(call[0]).includes('ocr.space')
      )
      expect(ocrCalls.length).toBeGreaterThan(1)
    })

    it('respects custom config', async () => {
      setMockResponses({
        OCRExitCode: 1,
        ParsedResults: [
          {
            TextOverlay: {
              Lines: [
                {
                  Words: [
                    {
                      WordText: 'text',
                      Left: 0,
                      Top: 0,
                      Width: 10,
                      Height: 10
                    }
                  ]
                }
              ]
            }
          }
        ]
      })

      await processImage(smallImageBuffer, {
        apiKey: 'test-key',
        language: 'eng',
        ocrEngine: 1
      })

      const ocrCall = mockFetch.mock.calls.find(
        call => String(call[0]).includes('ocr.space')
      )
      expect(ocrCall).toBeDefined()

      const body = ocrCall?.[1]?.body as FormData
      expect(body.get('language')).toBe('eng')
      expect(body.get('OCREngine')).toBe('1')
    })

    it('handles OCR API errors', async () => {
      setMockResponses({
        OCRExitCode: 2,
        ErrorMessage: 'API Error'
      })

      await expect(
        processImage(smallImageBuffer, { apiKey: 'test-key' })
      ).rejects.toThrow('OCR failed')
    })

    it('handles empty OCR results', async () => {
      setMockResponses({
        OCRExitCode: 1,
        ParsedResults: []
      })

      const results = await processImage(smallImageBuffer, {
        apiKey: 'test-key'
      })

      expect(results).toHaveLength(0)
    })

    it('handles multiple words in multiple lines', async () => {
      setMockResponses({
        OCRExitCode: 1,
        ParsedResults: [
          {
            TextOverlay: {
              Lines: [
                {
                  Words: [
                    {
                      WordText: '첫',
                      Left: 10,
                      Top: 10,
                      Width: 30,
                      Height: 20
                    },
                    {
                      WordText: '번째',
                      Left: 50,
                      Top: 10,
                      Width: 40,
                      Height: 20
                    }
                  ]
                },
                {
                  Words: [
                    {
                      WordText: '두',
                      Left: 10,
                      Top: 40,
                      Width: 30,
                      Height: 20
                    },
                    {
                      WordText: '번째',
                      Left: 50,
                      Top: 40,
                      Width: 40,
                      Height: 20
                    }
                  ]
                }
              ]
            }
          }
        ]
      })

      const results = await processImage(smallImageBuffer, {
        apiKey: 'test-key'
      })

      expect(results).toHaveLength(4)
      expect(results[0].text).toBe('첫')
      expect(results[1].text).toBe('번째')
      expect(results[2].text).toBe('두')
      expect(results[3].text).toBe('번째')
    })

    it('cleans up temp files on error', async () => {
      setMockReject(new Error('API Error'))

      await expect(
        processImage(smallImageBuffer, { apiKey: 'test-key' })
      ).rejects.toThrow()

      expect(mockUnlink).toHaveBeenCalled()
    })

    it('uses correct OCR engine parameter', async () => {
      setMockResponses({
        OCRExitCode: 1,
        ParsedResults: [{ TextOverlay: { Lines: [] } }]
      })

      await processImage(smallImageBuffer, {
        apiKey: 'test-key',
        ocrEngine: 2
      })

      const ocrCall = mockFetch.mock.calls.find(
        call => String(call[0]).includes('ocr.space')
      )
      const body = ocrCall?.[1]?.body as FormData
      expect(body.get('OCREngine')).toBe('2')
    })

    it('applies scale parameter', async () => {
      setMockResponses({
        OCRExitCode: 1,
        ParsedResults: [{ TextOverlay: { Lines: [] } }]
      })

      await processImage(smallImageBuffer, {
        apiKey: 'test-key',
        scale: true
      })

      const ocrCall = mockFetch.mock.calls.find(
        call => String(call[0]).includes('ocr.space')
      )
      const body = ocrCall?.[1]?.body as FormData
      expect(body.get('scale')).toBe('true')
    })
  })

  describe('integration with real test images', () => {
    let mainSampleBuffer: Buffer
    let largeSampleBuffer: Buffer

    beforeAll(async () => {
      mainSampleBuffer = await readFile(join(TEST_DATA_DIR, 'main-sample.jpg'))
      largeSampleBuffer = await readFile(join(TEST_DATA_DIR, 'large-sample.jpg'))
    })

    beforeEach(() => {
      mockFetch.mockClear()
      mockWriteFile.mockClear()
      mockUnlink.mockClear()
      mockResponses = []
      mockResponseIndex = 0
      shouldReject = false
      rejectError = null
    })

    it('processes main-sample.jpg without tiling', async () => {
      setMockResponses({
        OCRExitCode: 1,
        ParsedResults: [{
          TextOverlay: {
            Lines: [{
              Words: [
                { WordText: '내', Left: 217, Top: 486, Width: 51, Height: 58 }
              ]
            }]
          }
        }]
      })

      const results = await processImage(mainSampleBuffer, {
        apiKey: 'test-key'
      })

      expect(results).toHaveLength(1)
      const ocrCalls = mockFetch.mock.calls.filter(
        call => String(call[0]).includes('ocr.space')
      )
      expect(ocrCalls.length).toBe(1)
    })

    it('processes large-sample.jpg with tiling', async () => {
      setMockResponses({
        OCRExitCode: 1,
        ParsedResults: [{
          TextOverlay: {
            Lines: [{
              Words: [
                { WordText: 'E', Left: 195, Top: 325, Width: 57, Height: 93 }
              ]
            }]
          }
        }]
      })

      const results = await processImage(largeSampleBuffer, {
        apiKey: 'test-key'
      })

      expect(results.length).toBeGreaterThan(0)
      const ocrCalls = mockFetch.mock.calls.filter(
        call => String(call[0]).includes('ocr.space')
      )
      expect(ocrCalls.length).toBeGreaterThan(1)
    })

    it('cleans up temp files for each tile', async () => {
      setMockResponses({
        OCRExitCode: 1,
        ParsedResults: [{
          TextOverlay: {
            Lines: [{
              Words: [
                { WordText: 'test', Left: 0, Top: 0, Width: 10, Height: 10 }
              ]
            }]
          }
        }]
      })

      await processImage(largeSampleBuffer, { apiKey: 'test-key' })

      const ocrCalls = mockFetch.mock.calls.filter(
        call => String(call[0]).includes('ocr.space')
      )
      expect(mockUnlink.mock.calls.length).toBe(ocrCalls.length)
    })
  })

  describe('integration with real OCR output format', () => {
    let expectedOcrResults: Array<{
      text: string
      bbox: { x: number; y: number; width: number; height: number }
    }>

    beforeAll(async () => {
      const ocrPath = join(TEST_DATA_DIR, 'ocrOutputSample.json')
      expectedOcrResults = JSON.parse(await readFile(ocrPath, 'utf-8'))
    })

    beforeEach(() => {
      mockFetch.mockClear()
      mockResponses = []
      mockResponseIndex = 0
      shouldReject = false
      rejectError = null
    })

    it('parses OCR response matching real output format', async () => {
      setMockResponses({
        OCRExitCode: 1,
        ParsedResults: [{
          TextOverlay: {
            Lines: [
              {
                Words: expectedOcrResults.slice(0, 4).map(r => ({
                  WordText: r.text,
                  Left: r.bbox.x,
                  Top: r.bbox.y,
                  Width: r.bbox.width,
                  Height: r.bbox.height
                }))
              }
            ]
          }
        }]
      })

      const results = await processImage(smallImageBuffer, {
        apiKey: 'test-key'
      })

      expect(results).toHaveLength(4)
      expect(results[0]).toEqual(expectedOcrResults[0])
      expect(results[1]).toEqual(expectedOcrResults[1])
    })

    it('handles Korean text from Solo Leveling correctly', async () => {
      setMockResponses({
        OCRExitCode: 1,
        ParsedResults: [{
          TextOverlay: {
            Lines: [{
              Words: [
                { WordText: '내', Left: 217, Top: 486, Width: 51, Height: 58 },
                { WordText: '이름은', Left: 275, Top: 487, Width: 127, Height: 60 },
                { WordText: '성진우', Left: 241, Top: 544, Width: 119, Height: 59 }
              ]
            }]
          }
        }]
      })

      const results = await processImage(smallImageBuffer, {
        apiKey: 'test-key'
      })

      expect(results).toHaveLength(3)
      expect(results[0].text).toBe('내')
      expect(results[1].text).toBe('이름은')
      expect(results[2].text).toBe('성진우')
    })
  })
})
