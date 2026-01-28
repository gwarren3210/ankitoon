import { GenerateContentResponse, GoogleGenAI, Type } from '@google/genai'
import {
  ExtractedWord,
  ExtractedGrammar,
  ExtractionResult,
  WordExtractorConfig
} from '@/lib/pipeline/types'
import { WORD_EXTRACTION_PROMPT } from '@/lib/pipeline/prompts'
import {
  saveDebugJson,
  saveDebugText,
  isDebugEnabled
} from '@/lib/pipeline/debugArtifacts'
import { logger } from '@/lib/logger'

const DEFAULT_CONFIG: Omit<WordExtractorConfig, 'apiKey'> = {
  model: 'gemini-2.5-flash'
}

/**
 * Schema for individual vocabulary/grammar items.
 */
const ITEM_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    korean: { type: Type.STRING },
    english: { type: Type.STRING },
    importanceScore: { type: Type.NUMBER },
    senseKey: { type: Type.STRING },
    chapterExample: { type: Type.STRING },
    globalExample: { type: Type.STRING }
  },
  required: [
    'korean',
    'english',
    'importanceScore',
    'senseKey',
    'chapterExample',
    'globalExample'
  ]
}

/**
 * Schema for extraction result with both vocabulary and grammar arrays.
 * Matches the output_schema defined in wordExtraction.xml.
 */
const EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    vocabulary: {
      type: Type.ARRAY,
      items: ITEM_SCHEMA
    },
    grammar: {
      type: Type.ARRAY,
      items: ITEM_SCHEMA
    }
  },
  required: ['vocabulary', 'grammar']
}

/**
 * Extracts vocabulary and grammar from Korean dialogue using Gemini API.
 * Input: dialogue text and config with API key
 * Output: ExtractionResult with vocabulary and grammar arrays
 */
export async function extractVocabularyAndGrammar(
  dialogue: string,
  config: WordExtractorConfig
): Promise<ExtractionResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  logger.debug({
    dialogueLength: dialogue.length,
    model: cfg.model
  }, 'Extracting vocabulary and grammar from dialogue')

  if (!cfg.apiKey) {
    logger.error('GEMINI_API_KEY not configured')
    throw new Error('GEMINI_API_KEY not configured')
  }

  if (!dialogue || dialogue.trim().length === 0) {
    logger.warn('Empty dialogue provided')
    return { vocabulary: [], grammar: [] }
  }

  const ai = new GoogleGenAI({ apiKey: cfg.apiKey })
  const response = await callGeminiApi(ai, cfg.model!, dialogue)
  logger.debug({ response }, 'Gemini API response')
  const result = parseResponse(response)
  logger.debug({ result }, 'Parsed extraction result')

  if (isDebugEnabled()) {
    await saveDebugJson('extraction-result', result)
  }

  logger.info({
    vocabularyCount: result.vocabulary.length,
    grammarCount: result.grammar.length
  }, 'Extraction completed')
  return result
}

/**
 * Legacy function for backwards compatibility.
 * Extracts vocabulary words only (ignores grammar patterns).
 * @deprecated Use extractVocabularyAndGrammar() instead
 */
export async function extractWords(
  dialogue: string,
  config: WordExtractorConfig
): Promise<ExtractedWord[]> {
  const result = await extractVocabularyAndGrammar(dialogue, config)
  return result.vocabulary
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
    /  <dialogue>\n  <\/dialogue>/,
    `  <dialogue>\n${dialogue}\n  </dialogue>`
  )

  logger.debug({ model, promptLength: prompt.length }, 'Calling Gemini API')

  if (isDebugEnabled()) {
    await saveDebugText('extraction-prompt', prompt)
  }

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: EXTRACTION_SCHEMA
    }
  })

  if (!response?.candidates?.[0]?.content?.parts?.[0]?.text) {
    logger.error('Invalid response from Gemini API')
    logger.debug({ response }, 'Invalid response from Gemini API')
    throw new Error('Invalid response from Gemini API')
  }

  logger.debug('Gemini API call successful')

  if (isDebugEnabled()) {
    await saveDebugJson('extraction-response-raw', response)
  }

  return response
}

/**
 * Validates an item has all required fields.
 * Input: vocabulary or grammar item
 * Output: boolean indicating validity
 */
function isValidItem(
  item: ExtractedWord | ExtractedGrammar
): boolean {
  return !!(
    item.korean &&
    item.english &&
    typeof item.importanceScore === 'number' &&
    item.senseKey &&
    item.chapterExample &&
    item.globalExample
  )
}

/**
 * Parses Gemini API response into ExtractionResult.
 * Input: raw API response
 * Output: validated ExtractionResult with vocabulary and grammar arrays
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResponse(response: any): ExtractionResult {
  const text = response.candidates[0].content.parts[0].text
  const parsed = JSON.parse(text) as ExtractionResult

  if (!parsed || typeof parsed !== 'object') {
    logger.error('Gemini API response is not an object')
    throw new Error('Response is not an object')
  }

  if (!Array.isArray(parsed.vocabulary)) {
    logger.error('Gemini API response missing vocabulary array')
    throw new Error('Response missing vocabulary array')
  }

  if (!Array.isArray(parsed.grammar)) {
    logger.error('Gemini API response missing grammar array')
    throw new Error('Response missing grammar array')
  }

  const vocabulary = parsed.vocabulary.filter(isValidItem)
  const grammar = parsed.grammar.filter(isValidItem)

  logger.debug({
    rawVocabularyCount: parsed.vocabulary.length,
    filteredVocabularyCount: vocabulary.length,
    rawGrammarCount: parsed.grammar.length,
    filteredGrammarCount: grammar.length
  }, 'Parsed and filtered extraction result')

  return { vocabulary, grammar }
}

