import { GenerateContentResponse, GoogleGenAI, Type } from '@google/genai'
import { ExtractedWord, WordExtractorConfig } from '@/lib/pipeline/types'
import { WORD_EXTRACTION_PROMPT } from '@/lib/pipeline/prompts'
import { saveDebugJson, saveDebugText, isDebugEnabled } from '@/lib/pipeline/debugArtifacts'
import { logger } from '@/lib/logger'

const DEFAULT_CONFIG: Omit<WordExtractorConfig, 'apiKey'> = {
  model: 'gemini-2.5-flash'
}

const WORD_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      korean: { type: Type.STRING },
      english: { type: Type.STRING },
      importanceScore: { type: Type.NUMBER },
      senseKey: { type: Type.STRING }
    },
    required: ['korean', 'english', 'importanceScore', 'senseKey']
  }
}

/**
 * Extracts vocabulary words from Korean dialogue using Gemini API.
 * Input: dialogue text and config with API key
 * Output: array of extracted words with translations and importance scores
 */
export async function extractWords(
  dialogue: string,
  config: WordExtractorConfig
): Promise<ExtractedWord[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  logger.debug({
    dialogueLength: dialogue.length,
    model: cfg.model
  }, 'Extracting words from dialogue')

  if (!cfg.apiKey) {
    logger.error('GEMINI_API_KEY not configured')
    throw new Error('GEMINI_API_KEY not configured')
  }

  if (!dialogue || dialogue.trim().length === 0) {
    logger.warn('Empty dialogue provided')
    return []
  }

  const ai = new GoogleGenAI({ apiKey: cfg.apiKey })
  const response = await callGeminiApi(ai, cfg.model!, dialogue)
  const words = parseResponse(response)

  if (isDebugEnabled()) {
    await saveDebugJson('word-extraction-words', words)
  }

  logger.info({ wordCount: words.length }, 'Word extraction completed')
  return words
}

/**
 * Calls Gemini API with structured output schema.
 * Input: AI client, model name, dialogue text
 * Output: raw API response
 */
async function callGeminiApi(
  ai: GoogleGenAI,
  model: string,
  dialogue: string
): Promise<GenerateContentResponse> {
  const prompt = WORD_EXTRACTION_PROMPT.replace(
    '<dialogue>\n\n</dialogue>',
    `<dialogue>\n${dialogue}\n</dialogue>`
  )

  logger.debug({ model, promptLength: prompt.length }, 'Calling Gemini API')

  if (isDebugEnabled()) {
    await saveDebugText('word-extraction-prompt', prompt)
  }

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: WORD_SCHEMA
    }
  })

  if (!response?.candidates?.[0]?.content?.parts?.[0]?.text) {
    logger.error('Invalid response from Gemini API')
    throw new Error('Invalid response from Gemini API')
  }

  logger.debug('Gemini API call successful')

  if (isDebugEnabled()) {
    await saveDebugJson('word-extraction-response-raw', response)
  }

  return response
}

/**
 * Parses Gemini API response into ExtractedWord array.
 * Input: raw API response
 * Output: validated array of extracted words
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResponse(response: any): ExtractedWord[] {
  const text = response.candidates[0].content.parts[0].text
  const words = JSON.parse(text) as ExtractedWord[]

  if (!Array.isArray(words)) {
    logger.error('Gemini API response is not an array')
    throw new Error('Response is not an array')
  }

  const filtered = words.filter(
    w => w.korean && 
         w.english && 
         typeof w.importanceScore === 'number' &&
         w.senseKey
  )

  logger.debug({
    rawCount: words.length,
    filteredCount: filtered.length
  }, 'Parsed and filtered extracted words')

  return filtered
}

