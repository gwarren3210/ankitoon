import { createClient, RedisClientType } from 'redis'
import { logger } from '@/lib/logger'

let redisClient: RedisClientType | null = null
let isConnecting = false

/**
 * Gets or creates Redis client with lazy singleton pattern.
 * Handles reconnection if connection is lost.
 * Input: none
 * Output: Redis client instance
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient && redisClient.isOpen) {
    return redisClient
  }

  if (isConnecting) {
    // Wait for ongoing connection attempt
    while (isConnecting && (!redisClient || !redisClient.isOpen)) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (redisClient && redisClient.isOpen) {
      return redisClient
    }
  }

  isConnecting = true
  const startTime = Date.now()

  try {
    const redisUrl = process.env.REDIS_URL
    if (!redisUrl) {
      const error = new Error('REDIS_URL environment variable is not set')
      logger.error({ redisUrl: null }, 'Redis configuration error')
      throw error
    }

    logger.debug({ redisUrl: redisUrl.replace(/:[^:@]+@/, ':****@') }, 'Connecting to Redis')

    redisClient = createClient({ url: redisUrl }) as RedisClientType

    redisClient.on('error', (err) => {
      logger.error({ error: err.message, stack: err.stack }, 'Redis client error')
    })

    redisClient.on('connect', () => {
      logger.info('Redis client connected')
    })

    redisClient.on('reconnecting', () => {
      logger.warn('Redis client reconnecting')
    })

    await redisClient.connect()
    const connectTime = Date.now() - startTime
    logger.info({ connectTimeMs: connectTime }, 'Redis client connected successfully')

    return redisClient
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    logger.error(
      { error: errorMessage, stack: errorStack, connectTimeMs: Date.now() - startTime },
      'Failed to connect to Redis'
    )
    redisClient = null
    throw error
  } finally {
    isConnecting = false
  }
}

