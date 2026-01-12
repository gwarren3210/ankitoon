/**
 * Redis Client Tests
 *
 * Tests the Redis connection management with:
 * - Singleton pattern and promise-based locking
 * - 10-second timeout with 3 retries
 * - Exponential backoff (1s, 2s, 4s capped at 5s)
 * - Graceful shutdown
 *
 * NOTE: Due to Bun's mock.module() affecting global state,
 * tests that need different mock behaviors are isolated.
 */

import { describe, it, expect, beforeEach, mock, afterEach } from 'bun:test'

// Track mock state
let mockClient: any = null
let originalEnv: string | undefined

// Create a fresh mock client
function createMockClient(options: { isOpen?: boolean } = {}) {
  const client = {
    isOpen: options.isOpen ?? false,
    _eventHandlers: {} as Record<string, Function>,
    on: mock((event: string, handler: Function) => {
      client._eventHandlers[event] = handler
    }),
    connect: mock(() => {
      client.isOpen = true
      return Promise.resolve()
    }),
    quit: mock(() => Promise.resolve())
  }
  return client
}

// Mock the redis module - default behavior connects successfully
mock.module('redis', () => ({
  createClient: mock(() => {
    mockClient = createMockClient()
    return mockClient
  })
}))

// Mock logger
mock.module('@/lib/logger', () => ({
  logger: {
    error: mock(() => {}),
    warn: mock(() => {}),
    info: mock(() => {}),
    debug: mock(() => {})
  }
}))

// Helper to get a fresh module with reset state
async function getFreshModule() {
  const mod = await import('@/lib/redis/client')
  await mod.closeRedisClient()
  return mod
}

describe('Redis Client', () => {
  beforeEach(() => {
    // Reset mock state
    mockClient = null

    // Store and set REDIS_URL
    originalEnv = process.env.REDIS_URL
    process.env.REDIS_URL = 'redis://localhost:6379'
  })

  afterEach(async () => {
    // Restore environment
    if (originalEnv !== undefined) {
      process.env.REDIS_URL = originalEnv
    } else {
      delete process.env.REDIS_URL
    }

    // Close client to reset state between tests
    const { closeRedisClient } = await import('@/lib/redis/client')
    await closeRedisClient()
  })

  describe('getRedisClient', () => {
    it('creates and connects a new client', async () => {
      const { getRedisClient } = await getFreshModule()

      const client = await getRedisClient()

      expect(client).not.toBeNull()
      expect(client.isOpen).toBe(true)
      expect(mockClient.connect).toHaveBeenCalled()
    })

    it('returns existing open client without reconnecting', async () => {
      const { getRedisClient } = await getFreshModule()

      // First connection
      const client1 = await getRedisClient()
      const firstConnectCalls = mockClient.connect.mock.calls.length

      // Second call should return same client
      const client2 = await getRedisClient()

      expect(client1).toBe(client2)
      // Should not have called connect again
      expect(mockClient.connect.mock.calls.length).toBe(firstConnectCalls)
    })

    it('shares connection promise for concurrent calls', async () => {
      // Set up delayed connection
      let resolveConnection: (() => void) | null = null
      const delayedClient = {
        isOpen: false,
        on: mock(() => {}),
        connect: mock(
          () =>
            new Promise<void>((resolve) => {
              resolveConnection = () => {
                delayedClient.isOpen = true
                resolve()
              }
            })
        ),
        quit: mock(() => Promise.resolve())
      }

      mock.module('redis', () => ({
        createClient: mock(() => {
          mockClient = delayedClient
          return delayedClient
        })
      }))

      const freshModule = await getFreshModule()

      // Start two concurrent connection attempts
      const promise1 = freshModule.getRedisClient()
      const promise2 = freshModule.getRedisClient()

      // Only one createClient call should have been made
      expect(mockClient.connect.mock.calls.length).toBe(1)

      // Complete the connection
      resolveConnection!()

      const [client1, client2] = await Promise.all([promise1, promise2])
      expect(client1).toBe(client2)

      // Restore default mock
      mock.module('redis', () => ({
        createClient: mock(() => {
          mockClient = createMockClient()
          return mockClient
        })
      }))
    })

    it('throws when REDIS_URL is not set', async () => {
      delete process.env.REDIS_URL

      const freshModule = await getFreshModule()

      await expect(freshModule.getRedisClient()).rejects.toThrow(
        'REDIS_URL environment variable is not set'
      )
    })
  })

  describe('closeRedisClient', () => {
    it('closes open client and resets state', async () => {
      const { getRedisClient, closeRedisClient } = await getFreshModule()

      // Connect first
      await getRedisClient()
      expect(mockClient.isOpen).toBe(true)

      // Close
      await closeRedisClient()

      // Should have called quit
      expect(mockClient.quit).toHaveBeenCalled()
    })

    it('handles close when not connected', async () => {
      const { closeRedisClient } = await getFreshModule()

      // Should not throw when no client exists
      await expect(closeRedisClient()).resolves.toBeUndefined()
    })

    it('handles quit errors gracefully', async () => {
      const clientWithQuitError = {
        isOpen: false,
        on: mock(() => {}),
        connect: mock(() => {
          clientWithQuitError.isOpen = true
          return Promise.resolve()
        }),
        quit: mock(() => Promise.reject(new Error('Connection lost')))
      }

      mock.module('redis', () => ({
        createClient: mock(() => {
          mockClient = clientWithQuitError
          return clientWithQuitError
        })
      }))

      const freshModule = await getFreshModule()
      await freshModule.getRedisClient()

      // Should not throw despite quit error
      await expect(freshModule.closeRedisClient()).resolves.toBeUndefined()

      // Restore default mock
      mock.module('redis', () => ({
        createClient: mock(() => {
          mockClient = createMockClient()
          return mockClient
        })
      }))
    })

    it('resets connection promise allowing new connections', async () => {
      let connectCount = 0

      mock.module('redis', () => ({
        createClient: mock(() => {
          connectCount++
          mockClient = createMockClient()
          return mockClient
        })
      }))

      const freshModule = await getFreshModule()

      // First connection
      await freshModule.getRedisClient()
      expect(connectCount).toBe(1)

      // Close and reconnect
      await freshModule.closeRedisClient()
      await freshModule.getRedisClient()

      // Should create new client
      expect(connectCount).toBe(2)

      // Restore default mock
      mock.module('redis', () => ({
        createClient: mock(() => {
          mockClient = createMockClient()
          return mockClient
        })
      }))
    })
  })

  describe('event handlers', () => {
    it('registers error, connect, and reconnecting handlers', async () => {
      const { getRedisClient } = await getFreshModule()

      await getRedisClient()

      // Should have registered all event handlers
      expect(mockClient.on).toHaveBeenCalledWith('error', expect.any(Function))
      expect(mockClient.on).toHaveBeenCalledWith(
        'connect',
        expect.any(Function)
      )
      expect(mockClient.on).toHaveBeenCalledWith(
        'reconnecting',
        expect.any(Function)
      )
    })
  })

  describe('URL sanitization', () => {
    it('handles URL with password', async () => {
      process.env.REDIS_URL = 'redis://:secretpass@localhost:6379'

      const freshModule = await getFreshModule()

      const client = await freshModule.getRedisClient()
      expect(client.isOpen).toBe(true)
    })
  })
})

// Tests that require custom mock behavior and timer manipulation
// Run these in a separate describe to avoid contaminating other tests
describe('Redis Client - Retry Logic', () => {
  let originalSetTimeout: typeof global.setTimeout
  let originalEnv: string | undefined

  beforeEach(() => {
    originalSetTimeout = global.setTimeout
    originalEnv = process.env.REDIS_URL
    process.env.REDIS_URL = 'redis://localhost:6379'

    // Speed up backoff for tests
    // @ts-ignore
    global.setTimeout = (fn: Function, _delay: number) => {
      return originalSetTimeout(fn, 0)
    }
  })

  afterEach(async () => {
    global.setTimeout = originalSetTimeout

    if (originalEnv !== undefined) {
      process.env.REDIS_URL = originalEnv
    } else {
      delete process.env.REDIS_URL
    }

    const { closeRedisClient } = await import('@/lib/redis/client')
    await closeRedisClient()
  })

  it('retries on connection failure', async () => {
    let attemptNumber = 0

    mock.module('redis', () => ({
      createClient: mock(() => {
        attemptNumber++
        const client = {
          isOpen: false,
          on: mock(() => {}),
          connect: mock(() => {
            if (attemptNumber < 3) {
              return Promise.reject(new Error('Connection refused'))
            }
            client.isOpen = true
            return Promise.resolve()
          }),
          quit: mock(() => Promise.resolve())
        }
        return client
      })
    }))

    const freshModule = await import('@/lib/redis/client')
    await freshModule.closeRedisClient()

    const client = await freshModule.getRedisClient()

    expect(client.isOpen).toBe(true)
    expect(attemptNumber).toBe(3)
  })

  it('throws after all retries exhausted', async () => {
    mock.module('redis', () => ({
      createClient: mock(() => ({
        isOpen: false,
        on: mock(() => {}),
        connect: mock(() => Promise.reject(new Error('Network unreachable'))),
        quit: mock(() => Promise.resolve())
      }))
    }))

    const freshModule = await import('@/lib/redis/client')
    await freshModule.closeRedisClient()

    await expect(freshModule.getRedisClient()).rejects.toThrow(
      /Failed to connect to Redis after 3 attempts/
    )
  })

  it('cleans up client on connection failure', async () => {
    let quitCallCount = 0

    mock.module('redis', () => ({
      createClient: mock(() => ({
        isOpen: false,
        on: mock(() => {}),
        connect: mock(() => Promise.reject(new Error('Auth failed'))),
        quit: mock(() => {
          quitCallCount++
          return Promise.resolve()
        })
      }))
    }))

    const freshModule = await import('@/lib/redis/client')
    await freshModule.closeRedisClient()

    await freshModule.getRedisClient().catch(() => {})

    // Should have attempted cleanup after each failed attempt
    expect(quitCallCount).toBeGreaterThan(0)
  })

  it('throws when connection succeeds but isOpen is false', async () => {
    mock.module('redis', () => ({
      createClient: mock(() => ({
        isOpen: false, // Never becomes true
        on: mock(() => {}),
        connect: mock(() => Promise.resolve()), // Resolves but isOpen stays false
        quit: mock(() => Promise.resolve())
      }))
    }))

    const freshModule = await import('@/lib/redis/client')
    await freshModule.closeRedisClient()

    await expect(freshModule.getRedisClient()).rejects.toThrow(
      'Redis connection failed'
    )
  })
})

// Test backoff timing in isolation
describe('Redis Client - Backoff Timing', () => {
  let backoffDelays: number[] = []
  let originalSetTimeout: typeof global.setTimeout
  let originalEnv: string | undefined

  beforeEach(() => {
    backoffDelays = []
    originalSetTimeout = global.setTimeout
    originalEnv = process.env.REDIS_URL
    process.env.REDIS_URL = 'redis://localhost:6379'

    // Track backoff delays (1000-5000ms) and execute immediately
    // Filter out the 10000ms connection timeout
    // @ts-ignore
    global.setTimeout = (fn: Function, delay: number) => {
      if (delay >= 1000 && delay <= 5000) {
        backoffDelays.push(delay)
      }
      return originalSetTimeout(fn, 0)
    }
  })

  afterEach(async () => {
    global.setTimeout = originalSetTimeout

    if (originalEnv !== undefined) {
      process.env.REDIS_URL = originalEnv
    } else {
      delete process.env.REDIS_URL
    }

    const { closeRedisClient } = await import('@/lib/redis/client')
    await closeRedisClient()
  })

  it('uses exponential backoff delays', async () => {
    let attemptNumber = 0

    mock.module('redis', () => ({
      createClient: mock(() => {
        attemptNumber++
        const client = {
          isOpen: false,
          on: mock(() => {}),
          connect: mock(() => {
            if (attemptNumber < 3) {
              return Promise.reject(new Error('Connection refused'))
            }
            client.isOpen = true
            return Promise.resolve()
          }),
          quit: mock(() => Promise.resolve())
        }
        return client
      })
    }))

    const freshModule = await import('@/lib/redis/client')
    await freshModule.closeRedisClient()

    await freshModule.getRedisClient()

    // Should have 1s and 2s backoff delays
    expect(backoffDelays).toContain(1000)
    expect(backoffDelays).toContain(2000)
  })

  it('backoff pattern is 1s, 2s between retries', async () => {
    mock.module('redis', () => ({
      createClient: mock(() => ({
        isOpen: false,
        on: mock(() => {}),
        connect: mock(() => Promise.reject(new Error('Fail'))),
        quit: mock(() => Promise.resolve())
      }))
    }))

    const freshModule = await import('@/lib/redis/client')
    await freshModule.closeRedisClient()

    await freshModule.getRedisClient().catch(() => {})

    // With 3 retries: backoffs are after attempt 1 (1s) and attempt 2 (2s)
    // Attempt 3 fails and throws, no backoff after
    expect(backoffDelays[0]).toBe(1000)
    expect(backoffDelays[1]).toBe(2000)
  })
})
