import { promises as fs } from 'fs'
import * as path from 'path'
import { logger } from '@/lib/logger'

const ARTIFACTS_BASE_PATH = path.join(
  __dirname,
  '__tests__',
  'pipeline-artifacts'
)

let artifactsPath: string | null = null
let initialized = false

/**
 * Check if debug mode is enabled.
 * Output: boolean
 */
export function isDebugEnabled(): boolean {
  const envValue = process.env.PIPELINE_DEBUG
  const enabled = envValue === '1' || envValue === 'true' || envValue === 'TRUE'
  logger.debug({ envValue, Number: Number(envValue), Boolean: Boolean(Number(envValue)) }, 'Debug artifacts check')
  logger.debug({ 
    enabled, 
    envValue,
    rawEnv: process.env.PIPELINE_DEBUG 
  }, 'Debug artifacts check')
  return enabled
}

/**
 * Initialize artifacts directory for this run.
 * Creates timestamped subdirectory.
 * Output: void
 */
export async function initDebugArtifacts(): Promise<void> {
  if (!isDebugEnabled() || initialized) {
    logger.debug({ initialized }, 'Debug artifacts already initialized or disabled')
    return
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  artifactsPath = path.join(ARTIFACTS_BASE_PATH, timestamp)
  logger.debug({ artifactsPath }, 'Initializing debug artifacts directory')

  try {
    await fs.mkdir(artifactsPath, { recursive: true })
    initialized = true
    logger.info({ artifactsPath }, 'Debug artifacts directory created')
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : String(error),
      artifactsPath
    }, 'Failed to create debug artifacts directory')
    artifactsPath = null
  }
}

/**
 * Get current artifacts directory path.
 * Output: path string or null if disabled
 */
export function getArtifactsPath(): string | null {
  return artifactsPath
}

/**
 * Save image buffer to artifacts directory.
 * Input: filename without extension, image buffer
 * Output: void
 */
export async function saveDebugImage(
  name: string,
  buffer: Buffer
): Promise<void> {
  if (!artifactsPath) return

  try {
    const filePath = path.join(artifactsPath, `${name}.jpg`)
    await fs.writeFile(filePath, buffer)
    logger.debug({ name, filePath, bufferSize: buffer.length }, 'Saved debug image')
  } catch (error) {
    logger.error({
      name,
      error: error instanceof Error ? error.message : String(error)
    }, 'Failed to save debug image')
  }
}

/**
 * Save JSON data to artifacts directory.
 * Input: filename without extension, data object
 * Output: void
 */
export async function saveDebugJson(
  name: string,
  data: unknown
): Promise<void> {
  if (!artifactsPath) return
  logger.debug({ artifactsPath }, 'Saving debug JSON')
  try {
    const filePath = path.join(artifactsPath, `${name}.json`)
    const content = JSON.stringify(data, null, 2)
    await fs.writeFile(filePath, content)
    logger.debug({ name, filePath, contentLength: content.length }, 'Saved debug JSON')
  } catch (error) {
    logger.error({
      name,
      error: error instanceof Error ? error.message : String(error)
    }, 'Failed to save debug JSON')
  }
}

/**
 * Save text content to artifacts directory.
 * Input: filename without extension, text content
 * Output: void
 */
export async function saveDebugText(
  name: string,
  content: string
): Promise<void> {
  if (!artifactsPath) return

  try {
    const filePath = path.join(artifactsPath, `${name}.txt`)
    await fs.writeFile(filePath, content)
    logger.debug({ name, filePath, contentLength: content.length }, 'Saved debug text')
  } catch (error) {
    logger.error({
      name,
      error: error instanceof Error ? error.message : String(error)
    }, 'Failed to save debug text')
  }
}

/**
 * Reset module state for next pipeline run.
 * Output: void
 */
export function resetDebugArtifacts(): void {
  logger.debug('Resetting debug artifacts state')
  artifactsPath = null
  initialized = false
}
