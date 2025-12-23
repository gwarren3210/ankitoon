import { GoogleGenAI, Type } from '@google/genai'
import { ExtractedWord, WordExtractorConfig } from '@/lib/pipeline/types'

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
      importanceScore: { type: Type.NUMBER }
    },
    required: ['korean', 'english', 'importanceScore']
  }
}

const EXTRACTION_PROMPT = `You are a Korean language expert. Given the following \
Korean dialogue, extract the 100 most relevant words in dictionary form and \
provide their English translations.

Guidelines for word selection:
1. Focus on words that are:
   - Important for understanding the context
   - Commonly used in Korean
   - Useful for language learners
   - Not too basic (avoid words like 이, 그, 저)
2. Include a mix of nouns, verbs (dictionary form), adjectives (dictionary form)
3. Exclude duplicates, extremely basic words, onomatopoeia, names

Return words with:
- korean: the Korean word in dictionary form
- english: the English translation
- importanceScore: relevance to chapter/story (0-100)

Dialogue:
`

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

  if (!cfg.apiKey) {
    throw new Error('GEMINI_API_KEY not configured')
  }

  if (!dialogue || dialogue.trim().length === 0) {
    return []
  }

  const ai = new GoogleGenAI({ apiKey: cfg.apiKey })
  const response = await callGeminiApi(ai, cfg.model!, dialogue)

  return parseResponse(response)
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
): Promise<any> {
  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: `${EXTRACTION_PROMPT}${dialogue}` }] }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: WORD_SCHEMA
    }
  })

  if (!response?.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Invalid response from Gemini API')
  }

  return response
}

/**
 * Parses Gemini API response into ExtractedWord array.
 * Input: raw API response
 * Output: validated array of extracted words
 */
function parseResponse(response: any): ExtractedWord[] {
  const text = response.candidates[0].content.parts[0].text
  const words = JSON.parse(text) as ExtractedWord[]

  if (!Array.isArray(words)) {
    throw new Error('Response is not an array')
  }

  return words.filter(
    w => w.korean && w.english && typeof w.importanceScore === 'number'
  )
}

