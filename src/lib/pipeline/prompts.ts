import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Get current directory - works in both CommonJS and ESM
const getDirname = () => {
  try {
    // ESM context
    return dirname(fileURLToPath(import.meta.url))
  } catch {
    // CommonJS context (__dirname is available)
     
    return __dirname
  }
}

const PROMPTS_DIR = join(getDirname(), 'prompts')

export const WORD_EXTRACTION_PROMPT = readFileSync(
  join(PROMPTS_DIR, 'wordExtraction.md'),
  'utf-8'
)

