/**
 * Redis Mock - In-Memory Redis Client for Testing
 *
 * Simulates Redis behavior including:
 * - Key-value storage with TTL support
 * - Automatic expiration of keys
 * - Connection state tracking
 *
 * Use createMockRedis() to get a fresh mock for each test.
 */

import { mock } from 'bun:test'

export interface MockRedisEntry {
  value: string
  expiresAt: number | null // Unix timestamp or null for no expiry
}

export interface MockRedisConfig {
  isConnected: boolean
  shouldFailConnect: boolean
  connectError: Error | null
  operationError: Error | null
}

/**
 * Creates an in-memory Redis mock with TTL support.
 * Input: Optional initial config
 * Output: Mock Redis client and configuration helpers
 */
export function createMockRedis(initialConfig?: Partial<MockRedisConfig>) {
  const store = new Map<string, MockRedisEntry>()

  const config: MockRedisConfig = {
    isConnected: true,
    shouldFailConnect: false,
    connectError: null,
    operationError: null,
    ...initialConfig
  }

  /**
   * Checks if a key has expired and removes it if so.
   * Input: key
   * Output: true if key exists and is valid, false otherwise
   */
  const isKeyValid = (key: string): boolean => {
    const entry = store.get(key)
    if (!entry) return false
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      store.delete(key)
      return false
    }
    return true
  }

  /**
   * Throws operation error if configured.
   * Input: none
   * Output: void or throws
   */
  const checkOperationError = () => {
    if (config.operationError) {
      throw config.operationError
    }
  }

  const getMock = mock(async (key: string): Promise<string | null> => {
    checkOperationError()
    if (!isKeyValid(key)) return null
    return store.get(key)!.value
  })

  const setExMock = mock(async (
    key: string,
    ttlSeconds: number,
    value: string
  ): Promise<'OK'> => {
    checkOperationError()
    const expiresAt = Date.now() + (ttlSeconds * 1000)
    store.set(key, { value, expiresAt })
    return 'OK'
  })

  const setMock = mock(async (key: string, value: string): Promise<'OK'> => {
    checkOperationError()
    store.set(key, { value, expiresAt: null })
    return 'OK'
  })

  const delMock = mock(async (key: string): Promise<number> => {
    checkOperationError()
    const existed = store.has(key)
    store.delete(key)
    return existed ? 1 : 0
  })

  const expireMock = mock(async (key: string, ttlSeconds: number): Promise<number> => {
    checkOperationError()
    const entry = store.get(key)
    if (!entry) return 0
    entry.expiresAt = Date.now() + (ttlSeconds * 1000)
    return 1
  })

  const ttlMock = mock(async (key: string): Promise<number> => {
    checkOperationError()
    const entry = store.get(key)
    if (!entry) return -2 // Key doesn't exist
    if (!entry.expiresAt) return -1 // No TTL set
    const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000)
    return remaining > 0 ? remaining : -2
  })

  const existsMock = mock(async (key: string): Promise<number> => {
    checkOperationError()
    return isKeyValid(key) ? 1 : 0
  })

  const flushDbMock = mock(async (): Promise<'OK'> => {
    checkOperationError()
    store.clear()
    return 'OK'
  })

  const connectMock = mock(async (): Promise<void> => {
    if (config.shouldFailConnect) {
      throw config.connectError || new Error('Connection failed')
    }
    config.isConnected = true
  })

  const disconnectMock = mock(async (): Promise<void> => {
    config.isConnected = false
  })

  const quitMock = mock(async (): Promise<'OK'> => {
    config.isConnected = false
    return 'OK'
  })

  const onMock = mock((event: string, callback: (...args: unknown[]) => void) => {
    // Store event handlers if needed for testing
    return client
  })

  const client = {
    get: getMock,
    setEx: setExMock,
    set: setMock,
    del: delMock,
    expire: expireMock,
    ttl: ttlMock,
    exists: existsMock,
    flushDb: flushDbMock,
    connect: connectMock,
    disconnect: disconnectMock,
    quit: quitMock,
    on: onMock,
    get isOpen() {
      return config.isConnected
    },
    get isReady() {
      return config.isConnected
    }
  }

  return {
    client,
    store,
    config,
    mocks: {
      get: getMock,
      setEx: setExMock,
      set: setMock,
      del: delMock,
      expire: expireMock,
      ttl: ttlMock,
      exists: existsMock,
      flushDb: flushDbMock,
      connect: connectMock,
      disconnect: disconnectMock,
      quit: quitMock,
      on: onMock
    },

    /**
     * Sets a value directly in the store (bypassing mock).
     * Input: key, value, optional TTL in seconds
     * Output: void
     */
    setDirectly(key: string, value: string, ttlSeconds?: number) {
      const expiresAt = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null
      store.set(key, { value, expiresAt })
    },

    /**
     * Gets a value directly from the store (bypassing mock).
     * Input: key
     * Output: value or null
     */
    getDirectly(key: string): string | null {
      if (!isKeyValid(key)) return null
      return store.get(key)!.value
    },

    /**
     * Simulates time passing by adjusting all TTLs.
     * Input: seconds to advance
     * Output: void
     */
    advanceTime(seconds: number) {
      const advanceMs = seconds * 1000
      for (const [key, entry] of store.entries()) {
        if (entry.expiresAt) {
          entry.expiresAt -= advanceMs
        }
      }
    },

    /**
     * Sets the mock to fail on connect.
     * Input: optional error to throw
     * Output: void
     */
    setConnectError(error?: Error) {
      config.shouldFailConnect = true
      config.connectError = error || new Error('Connection failed')
    },

    /**
     * Sets an error to throw on any operation.
     * Input: error to throw
     * Output: void
     */
    setOperationError(error: Error) {
      config.operationError = error
    },

    /**
     * Clears all state and resets mocks.
     * Input: none
     * Output: void
     */
    reset() {
      store.clear()
      config.isConnected = true
      config.shouldFailConnect = false
      config.connectError = null
      config.operationError = null
      Object.values(this.mocks).forEach(m => {
        if ('mockClear' in m) {
          m.mockClear()
        }
      })
    }
  }
}

export type MockRedis = ReturnType<typeof createMockRedis>
