/**
 * Client-side API utilities with CSRF protection.
 * All state-changing requests automatically include CSRF tokens.
 */

/**
 * HTTP methods that require CSRF token validation.
 */
const CSRF_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH']

/**
 * Cookie name for CSRF token.
 * Uses __Host- prefix in production for additional security.
 */
const CSRF_COOKIE_NAME =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '__Host-ankitoon.x-csrf-token'
    : 'ankitoon.x-csrf-token'

/**
 * Retrieves CSRF token from cookie set by middleware.
 * The @edge-csrf library stores the token in a readable cookie.
 * Input: none
 * Output: token string or null if not found
 */
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null

  // Parse cookies and find the CSRF token
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === CSRF_COOKIE_NAME && value) {
      return decodeURIComponent(value)
    }
  }

  return null
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
    const csrfToken = getCsrfToken()
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
