/**
 * Client-side API utilities with CSRF protection.
 * All state-changing requests automatically include CSRF tokens.
 *
 * The @edge-csrf library uses a salted hash pattern:
 * - Cookie stores the SECRET
 * - Response header 'X-CSRF-Token' contains the derived TOKEN
 * - Client must send the TOKEN (not the secret) in request headers
 */

/**
 * HTTP methods that require CSRF token validation.
 */
const CSRF_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH']

/**
 * Response header name where @edge-csrf sends the derived token.
 */
const CSRF_RESPONSE_HEADER = 'X-CSRF-Token'

/**
 * Storage key for caching the CSRF token in sessionStorage.
 */
const CSRF_STORAGE_KEY = 'csrf-token'

/**
 * Retrieves CSRF token from sessionStorage.
 * The token is obtained from response headers and cached here.
 * Input: none
 * Output: token string or null if not found
 */
function getCsrfToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(CSRF_STORAGE_KEY)
}

/**
 * Stores CSRF token from response header into sessionStorage.
 * Input: Response object
 * Output: void
 */
function storeCsrfToken(response: Response): void {
  const token = response.headers.get(CSRF_RESPONSE_HEADER)
  if (token && typeof window !== 'undefined') {
    sessionStorage.setItem(CSRF_STORAGE_KEY, token)
  }
}

/**
 * Custom error class for CSRF failures.
 * Allows client code to detect and handle CSRF errors specifically.
 */
export class CsrfValidationError extends Error {
  constructor(message = 'CSRF validation failed') {
    super(message)
    this.name = 'CsrfValidationError'
  }
}

/**
 * Fetches a CSRF token by making a lightweight GET request.
 * The middleware generates a token and returns it in the response header.
 * Input: none
 * Output: token string
 */
async function fetchCsrfToken(): Promise<string> {
  // Make a GET request to any page to get a CSRF token
  const response = await fetch('/api/health', {
    method: 'GET',
    credentials: 'same-origin',
  })
  storeCsrfToken(response)
  const token = getCsrfToken()
  if (!token) {
    throw new CsrfValidationError('Failed to obtain CSRF token')
  }
  return token
}

/**
 * Fetch wrapper that automatically includes CSRF token for
 * state-changing requests.
 * Input: url, fetch options
 * Output: fetch Response
 * Throws: CsrfValidationError if CSRF validation fails
 */
export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers)
  const method = (options.method || 'GET').toUpperCase()

  // Add CSRF token for state-changing methods
  if (CSRF_METHODS.includes(method)) {
    let csrfToken = getCsrfToken()

    // If no token cached, fetch one first
    if (!csrfToken) {
      console.log('[fetchWithCsrf] No token cached, fetching...')
      csrfToken = await fetchCsrfToken()
    }

    console.log('[fetchWithCsrf] CSRF token for', method, url, ':',
      csrfToken ? 'present' : 'MISSING'
    )
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken)
    }
  }

  // Add JSON content type for requests with body (unless FormData)
  if (options.body && !(options.body instanceof FormData)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin',
  })

  // Always store the latest CSRF token from response
  storeCsrfToken(response)

  // Check for CSRF error response
  if (response.status === 403) {
    const data = await response.clone().json().catch(() => ({}))
    if (data.code === 'CSRF_ERROR') {
      throw new CsrfValidationError(data.error || 'CSRF validation failed')
    }
  }

  return response
}

/**
 * Convenience method for POST requests with JSON body.
 * Input: url, body data
 * Output: fetch Response
 */
export async function postJson<T>(url: string, data: T): Promise<Response> {
  return fetchWithCsrf(url, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Convenience method for PATCH requests with JSON body.
 * Input: url, body data
 * Output: fetch Response
 */
export async function patchJson<T>(url: string, data: T): Promise<Response> {
  return fetchWithCsrf(url, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

/**
 * Convenience method for DELETE requests.
 * Input: url
 * Output: fetch Response
 */
export async function deleteRequest(url: string): Promise<Response> {
  return fetchWithCsrf(url, {
    method: 'DELETE',
  })
}

/**
 * Convenience method for POST requests with FormData (file uploads).
 * Input: url, FormData
 * Output: fetch Response
 */
export async function postFormData(
  url: string,
  formData: FormData
): Promise<Response> {
  return fetchWithCsrf(url, {
    method: 'POST',
    body: formData,
  })
}
