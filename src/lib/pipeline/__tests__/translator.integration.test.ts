import { describe, it, expect, beforeAll } from 'bun:test'
import { readFile } from 'fs/promises'
import dotenv from 'dotenv'
import { join } from 'path'
import { extractWords } from '@/lib/pipeline/translator'
import { saveDebugJson, initDebugArtifacts } from '../debugArtifacts'
import { logger } from '@/lib/logger'

dotenv.config({ path: join(process.cwd(), '.env') })

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const TEST_DATA_DIR = join(__dirname, 'test-data')

describe('translator integration', () => {
  beforeAll(async () => {
    await initDebugArtifacts()
  })

  describe('solo leveling chapter 1', () => {
    it('extracts words correctly', async () => {
      if (!GEMINI_API_KEY) {
        console.log('Skipping: GEMINI_API_KEY not set')
        return
      }

      const result = await extractWords('테스트', { 
        apiKey: GEMINI_API_KEY 
      })
      logger.debug({ result }, 'Translated words result')
      await saveDebugJson('translator-test-solo-leveling-chapter-1-words', result)
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('full chapter dialogue', () => {
    it('extracts words from full zip dialogue', async () => {
      if (!GEMINI_API_KEY) {
        console.log('Skipping: GEMINI_API_KEY not set')
        return
      }

      const dialoguePath = join(TEST_DATA_DIR, 'zip-full-dialogue.txt')
      const dialogue = await readFile(dialoguePath, 'utf-8')

      logger.debug({ 
        dialogueLength: dialogue.length,
        dialogueLines: dialogue.split('\n').length
      }, 'Reading full dialogue from test data')

      const result = await extractWords(dialogue, {
        apiKey: GEMINI_API_KEY
      })

      logger.debug({ 
        wordCount: result.length 
      }, 'Extracted words from full dialogue')

      await saveDebugJson('translator-test-full-dialogue-words', result)

      expect(result.length).toBeGreaterThan(0)
      
      result.forEach(word => {
        expect(word).toHaveProperty('korean')
        expect(word).toHaveProperty('english')
        expect(word).toHaveProperty('importanceScore')
        expect(word).toHaveProperty('senseKey')
        expect(word).toHaveProperty('chapterExample')
        expect(word).toHaveProperty('globalExample')
        expect(typeof word.korean).toBe('string')
        expect(typeof word.english).toBe('string')
        expect(typeof word.importanceScore).toBe('number')
        expect(word.importanceScore).toBeGreaterThanOrEqual(0)
        expect(word.importanceScore).toBeLessThanOrEqual(100)
      })
    }, 5 * 60 * 1000) // 5 minutes
  })
})

