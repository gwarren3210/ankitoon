/**
 * Supabase Mock - Chainable Mock for Database Operations
 *
 * Creates a mock Supabase client that supports the chainable API pattern:
 * supabase.from('table').select('*').eq('id', '1').single()
 *
 * Configure responses using setQueryResponse() before each test.
 */

import { mock } from 'bun:test'

export interface MockQueryResult<T = unknown> {
  data: T | null
  error: { message: string; code?: string } | null
}

export interface MockSupabaseConfig {
  queryResponses: Map<string, MockQueryResult>
  rpcResponses: Map<string, MockQueryResult>
  authUser: { id: string } | null
  defaultError: { message: string; code?: string } | null
}

/**
 * Creates a chainable Supabase mock with configurable responses.
 * Input: Optional initial config
 * Output: Mock Supabase client and configuration helpers
 */
export function createMockSupabase(initialConfig?: Partial<MockSupabaseConfig>) {
  const config: MockSupabaseConfig = {
    queryResponses: new Map(),
    rpcResponses: new Map(),
    authUser: { id: 'test-user-id' },
    defaultError: null,
    ...initialConfig
  }

  let currentTable = ''
  let pendingResult: MockQueryResult = { data: null, error: null }

  const resolveQuery = () => {
    const key = currentTable
    if (config.queryResponses.has(key)) {
      return Promise.resolve(config.queryResponses.get(key)!)
    }
    if (config.defaultError) {
      return Promise.resolve({ data: null, error: config.defaultError })
    }
    return Promise.resolve(pendingResult)
  }

  const chainableMethods = {
    select: mock(() => chainableMethods),
    insert: mock((data: unknown) => {
      pendingResult = { data, error: null }
      return chainableMethods
    }),
    upsert: mock((data: unknown) => {
      pendingResult = { data, error: null }
      return chainableMethods
    }),
    update: mock((data: unknown) => {
      pendingResult = { data, error: null }
      return chainableMethods
    }),
    delete: mock(() => chainableMethods),
    eq: mock(() => chainableMethods),
    neq: mock(() => chainableMethods),
    in: mock(() => chainableMethods),
    is: mock(() => chainableMethods),
    order: mock(() => chainableMethods),
    limit: mock(() => chainableMethods),
    single: mock(() => resolveQuery()),
    maybeSingle: mock(() => resolveQuery()),
    then: (resolve: (value: MockQueryResult) => void) => {
      resolveQuery().then(resolve)
    }
  }

  const fromMock = mock((table: string) => {
    currentTable = table
    pendingResult = { data: null, error: null }
    return chainableMethods
  })

  const rpcMock = mock((fnName: string, params?: unknown) => {
    const key = fnName
    if (config.rpcResponses.has(key)) {
      return Promise.resolve(config.rpcResponses.get(key)!)
    }
    if (config.defaultError) {
      return Promise.resolve({ data: null, error: config.defaultError })
    }
    return Promise.resolve({ data: params, error: null })
  })

  const client = {
    from: fromMock,
    rpc: rpcMock,
    auth: {
      getUser: mock(() => Promise.resolve({
        data: { user: config.authUser },
        error: config.authUser ? null : { message: 'Not authenticated' }
      }))
    },
    storage: {
      from: mock(() => ({
        upload: mock(() => Promise.resolve({ data: { path: 'test-path' }, error: null })),
        getPublicUrl: mock(() => ({ data: { publicUrl: 'https://test.com/image.jpg' } })),
        remove: mock(() => Promise.resolve({ data: null, error: null }))
      }))
    }
  }

  return {
    client,
    config,
    mocks: {
      from: fromMock,
      rpc: rpcMock,
      ...chainableMethods
    },

    /**
     * Sets response for a table query.
     * Input: table name, response data and optional error
     * Output: void
     */
    setQueryResponse<T>(
      table: string,
      data: T | null,
      error: { message: string; code?: string } | null = null
    ) {
      config.queryResponses.set(table, { data, error })
    },

    /**
     * Sets response for an RPC function call.
     * Input: function name, response data and optional error
     * Output: void
     */
    setRpcResponse<T>(
      fnName: string,
      data: T | null,
      error: { message: string; code?: string } | null = null
    ) {
      config.rpcResponses.set(fnName, { data, error })
    },

    /**
     * Sets the authenticated user.
     * Input: user object or null for unauthenticated
     * Output: void
     */
    setAuthUser(user: { id: string } | null) {
      config.authUser = user
    },

    /**
     * Sets a default error for all queries.
     * Input: error object or null
     * Output: void
     */
    setDefaultError(error: { message: string; code?: string } | null) {
      config.defaultError = error
    },

    /**
     * Clears all mock responses and resets state.
     * Input: none
     * Output: void
     */
    reset() {
      config.queryResponses.clear()
      config.rpcResponses.clear()
      config.authUser = { id: 'test-user-id' }
      config.defaultError = null
      fromMock.mockClear()
      rpcMock.mockClear()
      Object.values(chainableMethods).forEach(m => {
        if (typeof m === 'function' && 'mockClear' in m) {
          (m as ReturnType<typeof mock>).mockClear()
        }
      })
    }
  }
}

export type MockSupabase = ReturnType<typeof createMockSupabase>
