import { describe, it, expect } from 'bun:test'
import { WORD_EXTRACTION_PROMPT } from '@/lib/pipeline/prompts'

describe('Markdown Import', () => {
  it('should import markdown file as string', () => {
    expect(typeof WORD_EXTRACTION_PROMPT).toBe('string')
    expect(WORD_EXTRACTION_PROMPT.length).toBeGreaterThan(0)
  })

  it('should contain expected prompt content', () => {
    expect(WORD_EXTRACTION_PROMPT).toContain('Korean language expert')
    expect(WORD_EXTRACTION_PROMPT).toContain('senseKey')
    expect(WORD_EXTRACTION_PROMPT).toContain('mal_horse')
  })

  it('should end with "Dialogue:"', () => {
    expect(WORD_EXTRACTION_PROMPT.trim()).toMatch(/Dialogue:\s*$/)
  })
})

