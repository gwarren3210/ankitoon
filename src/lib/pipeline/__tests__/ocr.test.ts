import { describe, it, expect, beforeEach, beforeAll, mock } from 'bun:test'
import sharp from 'sharp'

// Mock functions - must be defined before mock.module calls
interface OcrSpaceOpts {
  apiKey: string
  language: string
  OCREngine: string
  scale: boolean
  isTable: boolean
  isOverlayRequired: boolean
}

const mockOcrSpace = mock(
  (_path: string, _opts: OcrSpaceOpts) => Promise.resolve({})
)
const mockWriteFile = mock(() => Promise.resolve())
const mockUnlink = mock(() => Promise.resolve())

// Mock modules BEFORE importing the module that uses them
mock.module('ocr-space-api-wrapper', () => ({
  ocrSpace: mockOcrSpace
}))

mock.module('fs', () => ({
  promises: {
    writeFile: mockWriteFile,
    unlink: mockUnlink
  }
}))

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
    mockOcrSpace.mockClear()
    mockWriteFile.mockClear()
    mockUnlink.mockClear()
  })

  describe('processImage', () => {
    it('throws error when API key not configured', async () => {
      await expect(
        processImage(smallImageBuffer, { apiKey: '' })
      ).rejects.toThrow('OCR_API_KEY not configured')
    })

    it('processes small images without tiling', async () => {
      const mockResponse = {
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
      }

      mockOcrSpace.mockResolvedValueOnce(mockResponse)

      const results = await processImage(smallImageBuffer, {
        apiKey: 'test-key'
      })

      expect(results).toHaveLength(1)
      expect(results[0]).toEqual({
        text: '안녕',
        bbox: { x: 10, y: 20, width: 50, height: 30 }
      })
      expect(mockOcrSpace).toHaveBeenCalledTimes(1)
    })

    it('processes large images with tiling', async () => {
      const mockResponse = {
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
      }

      mockOcrSpace.mockResolvedValue(mockResponse)

      const results = await processImage(largeImageBuffer, {
        apiKey: 'test-key',
        fileSizeThreshold: 20 * 1024 // Force tiling with low threshold
      })

      expect(results.length).toBeGreaterThan(0)
      expect(mockOcrSpace.mock.calls.length).toBeGreaterThan(1)
    })

    it('respects custom config', async () => {
      const mockResponse = {
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
      }

      mockOcrSpace.mockResolvedValueOnce(mockResponse)

      await processImage(smallImageBuffer, {
        apiKey: 'test-key',
        language: 'eng',
        ocrEngine: 1
      })

      const callArgs = mockOcrSpace.mock.calls[0][1]
      expect(callArgs).toMatchObject({
        language: 'eng',
        OCREngine: '1'
      })
    })

    it('handles OCR API errors', async () => {
      mockOcrSpace.mockResolvedValueOnce({
        OCRExitCode: 2,
        ErrorMessage: 'API Error'
      })

      await expect(
        processImage(smallImageBuffer, { apiKey: 'test-key' })
      ).rejects.toThrow('OCR failed')
    })

    it('handles empty OCR results', async () => {
      mockOcrSpace.mockResolvedValueOnce({
        OCRExitCode: 1,
        ParsedResults: []
      })

      const results = await processImage(smallImageBuffer, {
        apiKey: 'test-key'
      })

      expect(results).toHaveLength(0)
    })

    it('handles multiple words in multiple lines', async () => {
      const mockResponse = {
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
      }

      mockOcrSpace.mockResolvedValueOnce(mockResponse)

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
      mockOcrSpace.mockRejectedValueOnce(new Error('API Error'))

      await expect(
        processImage(smallImageBuffer, { apiKey: 'test-key' })
      ).rejects.toThrow()

      expect(mockUnlink).toHaveBeenCalled()
    })

    it('uses correct OCR engine parameter', async () => {
      mockOcrSpace.mockResolvedValueOnce({
        OCRExitCode: 1,
        ParsedResults: [{ TextOverlay: { Lines: [] } }]
      })

      await processImage(smallImageBuffer, {
        apiKey: 'test-key',
        ocrEngine: 2
      })

      const callArgs = mockOcrSpace.mock.calls[0][1]
      expect(callArgs?.OCREngine).toBe('2')
    })

    it('applies scale parameter', async () => {
      mockOcrSpace.mockResolvedValueOnce({
        OCRExitCode: 1,
        ParsedResults: [{ TextOverlay: { Lines: [] } }]
      })

      await processImage(smallImageBuffer, {
        apiKey: 'test-key',
        scale: true
      })

      const callArgs = mockOcrSpace.mock.calls[0][1]
      expect(callArgs?.scale).toBe(true)
    })
  })
})
