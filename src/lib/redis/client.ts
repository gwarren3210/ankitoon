import { createClient, RedisClientType } from 'redis'
import { logger } from '@/lib/logger'

/**
 * Redis connection configuration for serverless environments.
 * Tuned for Vercel functions with 10-60 second timeouts.
 */
const CONNECTION_TIMEOUT_MS = 10000
const MAX_RETRIES = 3
const MAX_BACKOFF_MS = 5000

let redisClient: RedisClientType | null = null
let connectionPromise: Promise<void> | null = null

/**
 * Gets or creates Redis client with promise-based locking.
 * Avoids duplicate connection attempts within a single invocation.
 * Input: none
 * Output: Redis client instance
 * Throws: Error if connection fails after retries or timeout
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient?.isOpen) {
    return redisClient
  }

  if (connectionPromise) {
    await connectionPromise
    if (!redisClient?.isOpen) {
      throw new Error('Redis connection failed')
    }
    return redisClient
  }

  connectionPromise = connectWithTimeout()

  try {
    await connectionPromise
    if (!redisClient?.isOpen) {
      throw new Error('Redis connection failed')
    }
    return redisClient
  } finally {
    connectionPromise = null
  }
}

/**
 * Connects to Redis with timeout and retry logic.
 * Uses exponential backoff: 1s, 2s, 4s (capped at 5s).
 * Input: none
 * Output: void (sets redisClient module variable)
 * Throws: Error if all retries fail or timeout
 */
async function connectWithTimeout(): Promise<void> {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    const error = new Error('REDIS_URL environment variable is not set')
    logger.error({ redisUrl: null }, 'Redis configuration error')
    throw error
  }

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const startTime = Date.now()

    try {
      logger.debug(
        {
          attempt,
          maxRetries: MAX_RETRIES,
          redisUrl: redisUrl.replace(/:[^:@]+@/, ':****@')
        },
        'Attempting Redis connection'
      )

      redisClient = createClient({ url: redisUrl }) as RedisClientType

      redisClient.on('error', (err) => {
        logger.error(
          { error: err.message, stack: err.stack },
          'Redis client error'
        )
      })

      redisClient.on('connect', () => {
        logger.info('Redis client connected')
      })

      redisClient.on('reconnecting', () => {
        logger.warn('Redis client reconnecting')
      })

      await Promise.race([
        redisClient.connect(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Redis connection timeout')),
            CONNECTION_TIMEOUT_MS
          )
        )
      ])

      const connectTime = Date.now() - startTime
      logger.info(
        { attempt, maxRetries: MAX_RETRIES, connectTimeMs: connectTime },
        'Redis connected successfully'
      )
      return
    } catch (error) {
      lastError = error as Error
      const connectTime = Date.now() - startTime

      logger.warn(
        {
          attempt,
          maxRetries: MAX_RETRIES,
          error: lastError.message,
          connectTimeMs: connectTime
        },
        'Redis connection attempt failed'
      )

      if (redisClient) {
        await redisClient.quit().catch(() => {})
        redisClient = null
      }

      if (attempt < MAX_RETRIES) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), MAX_BACKOFF_MS)
        logger.debug(
          { attempt, backoffMs },
          'Waiting before retry'
        )
        await new Promise((resolve) => setTimeout(resolve, backoffMs))
      }
    }
  }

  logger.error(
    { maxRetries: MAX_RETRIES, error: lastError?.message },
    'Failed to connect to Redis after all retries'
  )
  throw new Error(
    `Failed to connect to Redis after ${MAX_RETRIES} attempts: ${lastError?.message}`
  )
}

/**
 * Gracefully closes Redis connection.
 * Safe to call even if not connected.
 * Input: none
 * Output: void
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit().catch(() => {})
    redisClient = null
  }
  connectionPromise = null
}
