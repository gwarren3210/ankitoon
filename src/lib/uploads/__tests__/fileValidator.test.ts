/**
 * File Validator Tests
 *
 * Tests secure file upload validation:
 * - File size limits (5MB max, non-empty)
 * - Magic byte validation (JPEG, PNG, WebP only)
 * - Dimension limits (2048x2048 max)
 * - Image re-encoding (strips metadata)
 * - Secure filename generation
 * - Malware signature detection
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test'

// Mock file-type module
const mockFileTypeFromBuffer = mock(() => Promise.resolve(null))
mock.module('file-type', () => ({
  fileTypeFromBuffer: mockFileTypeFromBuffer
}))

// Mock sharp module
const mockMetadata = mock(() => Promise.resolve({ width: 100, height: 100 }))
const mockToBuffer = mock(() => Promise.resolve(Buffer.from('sanitized')))
const mockJpeg = mock(() => ({ toBuffer: mockToBuffer }))
const mockResize = mock(() => ({ jpeg: mockJpeg }))
const mockSharp = mock(() => ({
  metadata: mockMetadata,
  resize: mockResize
}))

mock.module('sharp', () => ({
  default: mockSharp
}))

// Mock logger
mock.module('@/lib/logger', () => ({
  logger: {
    error: mock(() => {}),
    warn: mock(() => {}),
    info: mock(() => {}),
    debug: mock(() => {})
  }
}))

// Mock api error classes
mock.module('@/lib/api', () => ({
  BadRequestError: class BadRequestError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'BadRequestError'
    }
  }
}))

// Import after mocks
const {
  validateImageFile,
  generateSecureFilename,
  checkMalwareSignatures
} = await import('@/lib/uploads/fileValidator')

// Helper to create mock File objects
function createMockFile(
  content: string | Buffer,
  name: string = 'test.jpg',
  type: string = 'image/jpeg'
): File {
  const buffer =
    typeof content === 'string' ? Buffer.from(content) : content
  const blob = new Blob([buffer], { type })
  return new File([blob], name, { type })
}

describe('fileValidator', () => {
  beforeEach(() => {
    // Reset mocks
    mockFileTypeFromBuffer.mockReset()
    mockMetadata.mockReset()
    mockToBuffer.mockReset()

    // Set up default successful behavior
    mockFileTypeFromBuffer.mockImplementation(() =>
      Promise.resolve({ ext: 'jpg', mime: 'image/jpeg' })
    )
    mockMetadata.mockImplementation(() =>
      Promise.resolve({ width: 100, height: 100 })
    )
    mockToBuffer.mockImplementation(() =>
      Promise.resolve(Buffer.from('sanitized'))
    )
  })

  describe('validateImageFile', () => {
    describe('size validation', () => {
      it('rejects files larger than 5MB', async () => {
        // Create a file larger than 5MB
        const largeContent = Buffer.alloc(5 * 1024 * 1024 + 1)
        const file = createMockFile(largeContent)

        await expect(validateImageFile(file)).rejects.toThrow(
          'File size must be less than 5MB'
        )
      })

      it('rejects empty files', async () => {
        const file = createMockFile('')

        await expect(validateImageFile(file)).rejects.toThrow('File is empty')
      })

      it('accepts files at exactly 5MB', async () => {
        const content = Buffer.alloc(5 * 1024 * 1024)
        const file = createMockFile(content)

        const result = await validateImageFile(file)
        expect(result.buffer).toBeDefined()
      })
    })

    describe('magic byte validation', () => {
      it('accepts JPEG files', async () => {
        mockFileTypeFromBuffer.mockImplementation(() =>
          Promise.resolve({ ext: 'jpg', mime: 'image/jpeg' })
        )

        const file = createMockFile('fake-jpeg-content')
        const result = await validateImageFile(file)

        expect(result.mimeType).toBe('image/jpeg')
      })

      it('accepts PNG files', async () => {
        mockFileTypeFromBuffer.mockImplementation(() =>
          Promise.resolve({ ext: 'png', mime: 'image/png' })
        )

        const file = createMockFile('fake-png-content')
        const result = await validateImageFile(file)

        expect(result.mimeType).toBe('image/jpeg') // Re-encoded to JPEG
      })

      it('accepts WebP files', async () => {
        mockFileTypeFromBuffer.mockImplementation(() =>
          Promise.resolve({ ext: 'webp', mime: 'image/webp' })
        )

        const file = createMockFile('fake-webp-content')
        const result = await validateImageFile(file)

        expect(result.mimeType).toBe('image/jpeg')
      })

      it('rejects SVG files (XSS risk)', async () => {
        mockFileTypeFromBuffer.mockImplementation(() =>
          Promise.resolve({ ext: 'svg', mime: 'image/svg+xml' })
        )

        const file = createMockFile('<svg></svg>')

        await expect(validateImageFile(file)).rejects.toThrow(
          'Only JPEG, PNG, and WebP images are allowed'
        )
      })

      it('rejects GIF files', async () => {
        mockFileTypeFromBuffer.mockImplementation(() =>
          Promise.resolve({ ext: 'gif', mime: 'image/gif' })
        )

        const file = createMockFile('fake-gif-content')

        await expect(validateImageFile(file)).rejects.toThrow(
          'Only JPEG, PNG, and WebP images are allowed'
        )
      })

      it('rejects files with undetectable type', async () => {
        mockFileTypeFromBuffer.mockImplementation(() => Promise.resolve(null))

        const file = createMockFile('random-binary-content')

        await expect(validateImageFile(file)).rejects.toThrow(
          'Invalid file format'
        )
      })

      it('rejects executable files masquerading as images', async () => {
        mockFileTypeFromBuffer.mockImplementation(() =>
          Promise.resolve({ ext: 'exe', mime: 'application/x-msdownload' })
        )

        const file = createMockFile('MZ...')

        await expect(validateImageFile(file)).rejects.toThrow(
          'Only JPEG, PNG, and WebP images are allowed'
        )
      })
    })

    describe('dimension validation', () => {
      it('rejects images wider than 2048px', async () => {
        mockMetadata.mockImplementation(() =>
          Promise.resolve({ width: 2049, height: 1000 })
        )

        const file = createMockFile('wide-image')

        await expect(validateImageFile(file)).rejects.toThrow(
          'Image dimensions must be 2048x2048 or smaller'
        )
      })

      it('rejects images taller than 2048px', async () => {
        mockMetadata.mockImplementation(() =>
          Promise.resolve({ width: 1000, height: 2049 })
        )

        const file = createMockFile('tall-image')

        await expect(validateImageFile(file)).rejects.toThrow(
          'Image dimensions must be 2048x2048 or smaller'
        )
      })

      it('accepts images at exactly 2048x2048', async () => {
        mockMetadata.mockImplementation(() =>
          Promise.resolve({ width: 2048, height: 2048 })
        )

        const file = createMockFile('max-size-image')
        const result = await validateImageFile(file)

        expect(result.width).toBe(2048)
        expect(result.height).toBe(2048)
      })

      it('rejects images with missing dimensions', async () => {
        mockMetadata.mockImplementation(() =>
          Promise.resolve({ width: undefined, height: undefined })
        )

        const file = createMockFile('no-dimensions')

        await expect(validateImageFile(file)).rejects.toThrow(
          'Could not read image dimensions'
        )
      })

      it('rejects corrupted images', async () => {
        mockMetadata.mockImplementation(() =>
          Promise.reject(new Error('Sharp error'))
        )

        const file = createMockFile('corrupted-content')

        await expect(validateImageFile(file)).rejects.toThrow(
          'Invalid or corrupted image file'
        )
      })
    })

    describe('sanitization', () => {
      it('returns sanitized buffer', async () => {
        const sanitizedContent = Buffer.from('sanitized-jpeg-output')
        mockToBuffer.mockImplementation(() => Promise.resolve(sanitizedContent))

        const file = createMockFile('original-image')
        const result = await validateImageFile(file)

        expect(result.buffer).toEqual(sanitizedContent)
      })

      it('always outputs JPEG format', async () => {
        mockFileTypeFromBuffer.mockImplementation(() =>
          Promise.resolve({ ext: 'png', mime: 'image/png' })
        )

        const file = createMockFile('png-content')
        const result = await validateImageFile(file)

        expect(result.mimeType).toBe('image/jpeg')
      })

      it('returns original dimensions in result', async () => {
        mockMetadata.mockImplementation(() =>
          Promise.resolve({ width: 800, height: 600 })
        )

        const file = createMockFile('image-content')
        const result = await validateImageFile(file)

        expect(result.width).toBe(800)
        expect(result.height).toBe(600)
      })
    })
  })

  describe('generateSecureFilename', () => {
    it('generates path with SHA-256 hash prefix', () => {
      const filename = generateSecureFilename('user-123')

      // Should be format: {8-char-hash}/{uuid}.jpg
      expect(filename).toMatch(/^[a-f0-9]{8}\/[a-f0-9-]{36}\.jpg$/)
    })

    it('generates different paths for different users', () => {
      const filename1 = generateSecureFilename('user-1')
      const filename2 = generateSecureFilename('user-2')

      // Hash prefixes should be different
      const hash1 = filename1.split('/')[0]
      const hash2 = filename2.split('/')[0]

      expect(hash1).not.toBe(hash2)
    })

    it('generates unique filenames for same user', () => {
      const filename1 = generateSecureFilename('user-123')
      const filename2 = generateSecureFilename('user-123')

      // Same hash prefix, different UUIDs
      expect(filename1.split('/')[0]).toBe(filename2.split('/')[0])
      expect(filename1).not.toBe(filename2)
    })

    it('produces consistent hash for same userId', () => {
      const filename1 = generateSecureFilename('consistent-user')
      const filename2 = generateSecureFilename('consistent-user')

      const hash1 = filename1.split('/')[0]
      const hash2 = filename2.split('/')[0]

      expect(hash1).toBe(hash2)
    })

    it('uses .jpg extension', () => {
      const filename = generateSecureFilename('user-id')

      expect(filename).toMatch(/\.jpg$/)
    })
  })

  describe('checkMalwareSignatures', () => {
    describe('detects script injection', () => {
      it('detects <script> tags', () => {
        const buffer = Buffer.from('<script>alert("xss")</script>')
        expect(checkMalwareSignatures(buffer)).toBe(false)
      })

      it('detects javascript: protocol', () => {
        const buffer = Buffer.from('javascript:alert(1)')
        expect(checkMalwareSignatures(buffer)).toBe(false)
      })

      it('detects onerror handler', () => {
        const buffer = Buffer.from('<img onerror="alert(1)">')
        expect(checkMalwareSignatures(buffer)).toBe(false)
      })

      it('detects onload handler', () => {
        const buffer = Buffer.from('<body onload="malicious()">')
        expect(checkMalwareSignatures(buffer)).toBe(false)
      })

      it('detects onclick handler', () => {
        const buffer = Buffer.from('<div onclick="hack()">')
        expect(checkMalwareSignatures(buffer)).toBe(false)
      })

      it('detects onmouseover handler', () => {
        const buffer = Buffer.from('<a onmouseover="steal()">')
        expect(checkMalwareSignatures(buffer)).toBe(false)
      })
    })

    describe('detects PHP/ASP injection', () => {
      it('detects <?php opening tag', () => {
        const buffer = Buffer.from('<?php system($_GET["cmd"]); ?>')
        expect(checkMalwareSignatures(buffer)).toBe(false)
      })

      it('detects ASP-style opening tag with space', () => {
        const buffer = Buffer.from('<% Response.Write("test") %>')
        expect(checkMalwareSignatures(buffer)).toBe(false)
      })

      it('detects ASP-style equals tag', () => {
        const buffer = Buffer.from('<%= variable %>')
        expect(checkMalwareSignatures(buffer)).toBe(false)
      })

      it('detects ASP-style directive tag', () => {
        const buffer = Buffer.from('<%@ Page Language="C#" %>')
        expect(checkMalwareSignatures(buffer)).toBe(false)
      })
    })

    describe('detects code execution', () => {
      it('detects eval()', () => {
        const buffer = Buffer.from('eval("malicious code")')
        expect(checkMalwareSignatures(buffer)).toBe(false)
      })

      it('detects system()', () => {
        const buffer = Buffer.from('system("rm -rf /")')
        expect(checkMalwareSignatures(buffer)).toBe(false)
      })

      it('detects exec()', () => {
        const buffer = Buffer.from('exec("command")')
        expect(checkMalwareSignatures(buffer)).toBe(false)
      })

      it('detects shell_exec', () => {
        const buffer = Buffer.from('shell_exec("ls")')
        expect(checkMalwareSignatures(buffer)).toBe(false)
      })

      it('detects passthru', () => {
        const buffer = Buffer.from('passthru($cmd)')
        expect(checkMalwareSignatures(buffer)).toBe(false)
      })

      it('detects base64_decode', () => {
        const buffer = Buffer.from('base64_decode("encoded_payload")')
        expect(checkMalwareSignatures(buffer)).toBe(false)
      })
    })

    describe('detects document manipulation', () => {
      it('detects document.cookie', () => {
        const buffer = Buffer.from('document.cookie')
        expect(checkMalwareSignatures(buffer)).toBe(false)
      })

      it('detects document.location', () => {
        const buffer = Buffer.from('document.location = "evil.com"')
        expect(checkMalwareSignatures(buffer)).toBe(false)
      })

      it('detects document.write', () => {
        const buffer = Buffer.from('document.write("<script>")')
        expect(checkMalwareSignatures(buffer)).toBe(false)
      })
    })

    describe('allows safe content', () => {
      it('allows normal image binary data', () => {
        // JPEG magic bytes + some binary content
        const buffer = Buffer.from([
          0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46
        ])
        expect(checkMalwareSignatures(buffer)).toBe(true)
      })

      it('allows empty buffer', () => {
        const buffer = Buffer.from('')
        expect(checkMalwareSignatures(buffer)).toBe(true)
      })

      it('allows normal text content', () => {
        const buffer = Buffer.from('Hello, this is normal text content.')
        expect(checkMalwareSignatures(buffer)).toBe(true)
      })

      it('only checks first 2048 bytes', () => {
        // Create buffer with malicious content after 2048 bytes
        const safeContent = Buffer.alloc(2048, 'a')
        const maliciousContent = Buffer.from('<script>alert(1)</script>')
        const buffer = Buffer.concat([safeContent, maliciousContent])

        // Should be safe because only first 2048 bytes are checked
        expect(checkMalwareSignatures(buffer)).toBe(true)
      })
    })

    describe('case sensitivity', () => {
      it('detects uppercase SCRIPT tags', () => {
        const buffer = Buffer.from('<SCRIPT>alert(1)</SCRIPT>')
        expect(checkMalwareSignatures(buffer)).toBe(false)
      })

      it('detects mixed case ScRiPt tags', () => {
        const buffer = Buffer.from('<ScRiPt>alert(1)</ScRiPt>')
        expect(checkMalwareSignatures(buffer)).toBe(false)
      })

      it('detects uppercase EVAL', () => {
        const buffer = Buffer.from('EVAL("code")')
        expect(checkMalwareSignatures(buffer)).toBe(false)
      })
    })
  })
})
