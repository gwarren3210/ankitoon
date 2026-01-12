import { NextResponse } from 'next/server'
import { getRedisClient } from '@/lib/redis/client'

/**
 * GET /api/health
 * Health check endpoint for monitoring and load balancers.
 * Returns 200 if Redis is connected, 503 if unhealthy.
 * Input: none
 * Output: { status, redis, timestamp }
 */
export async function GET() {
  const startTime = Date.now()

  try {
    const redis = await getRedisClient()
    await redis.ping()
    const latencyMs = Date.now() - startTime

    return NextResponse.json({
      status: 'healthy',
      redis: 'connected',
      latencyMs,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    const latencyMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        status: 'unhealthy',
        redis: 'disconnected',
        error: errorMessage,
        latencyMs,
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    )
  }
}
