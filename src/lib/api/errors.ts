/**
 * API Error Types and Classes
 * Provides consistent error handling across all API routes.
 */

/**
 * Standard error codes for API responses.
 * Maps to HTTP status codes and provides semantic meaning.
 */
export enum ErrorCode {
  // 400 Bad Request
  BAD_REQUEST = 'BAD_REQUEST',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_JSON = 'INVALID_JSON',

  // 401 Unauthorized
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // 403 Forbidden
  FORBIDDEN = 'FORBIDDEN',
  ADMIN_REQUIRED = 'ADMIN_REQUIRED',

  // 404 Not Found
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',

  // 409 Conflict
  CONFLICT = 'CONFLICT',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',

  // 429 Too Many Requests
  RATE_LIMITED = 'RATE_LIMITED',

  // 500 Internal Server Error
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR'
}

/**
 * Maps error codes to HTTP status codes.
 */
export const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_JSON]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.ADMIN_REQUIRED]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.SESSION_NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.DUPLICATE_RESOURCE]: 409,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 500
}

/**
 * Standard API error response shape.
 * Input: error details from ApiError
 * Output: consistent JSON structure for all API responses
 */
export interface ApiErrorResponse {
  /** Human-readable error message */
  error: string
  /** Machine-readable error code */
  code: ErrorCode
  /** Human-friendly validation error messages */
  details?: string[]
  /** Stack trace or additional info - development only */
  debug?: string
  /** Request ID for tracing */
  requestId?: string
}

/**
 * Base API error class.
 * All custom API errors extend this class.
 * Input: message, error code, optional validation details
 * Output: Error instance with status code and formatting info
 */
export class ApiError extends Error {
  readonly code: ErrorCode
  readonly statusCode: number
  readonly details?: string[]
  readonly isOperational: boolean = true

  constructor(message: string, code: ErrorCode, details?: string[]) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.statusCode = ERROR_STATUS_MAP[code]
    this.details = details

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

/**
 * Authentication error - user not authenticated.
 * Status: 401 Unauthorized
 */
export class UnauthorizedError extends ApiError {
  constructor(message = 'Authentication required') {
    super(message, ErrorCode.UNAUTHORIZED)
    this.name = 'UnauthorizedError'
  }
}

/**
 * Forbidden error - user lacks permission.
 * Status: 403 Forbidden
 */
export class ForbiddenError extends ApiError {
  constructor(message = 'Access denied') {
    super(message, ErrorCode.FORBIDDEN)
    this.name = 'ForbiddenError'
  }
}

/**
 * Admin required error - user is not admin.
 * Status: 403 Forbidden
 */
export class AdminRequiredError extends ApiError {
  constructor(message = 'Admin access required') {
    super(message, ErrorCode.ADMIN_REQUIRED)
    this.name = 'AdminRequiredError'
  }
}

/**
 * Not found error - resource does not exist.
 * Status: 404 Not Found
 */
export class NotFoundError extends ApiError {
  constructor(resource: string, message?: string) {
    super(message || `${resource} not found`, ErrorCode.NOT_FOUND)
    this.name = 'NotFoundError'
  }
}

/**
 * Session not found error - study session expired or missing.
 * Status: 404 Not Found
 */
export class SessionNotFoundError extends ApiError {
  constructor(message = 'Session not found or expired') {
    super(message, ErrorCode.SESSION_NOT_FOUND)
    this.name = 'SessionNotFoundError'
  }
}

/**
 * Validation error - request body failed schema validation.
 * Status: 400 Bad Request
 * Note: details contains human-friendly error messages, not raw Zod issues
 */
export class ValidationError extends ApiError {
  constructor(details: string[], message = 'Validation failed') {
    super(message, ErrorCode.VALIDATION_ERROR, details)
    this.name = 'ValidationError'
  }
}

/**
 * Invalid JSON error - request body is not valid JSON.
 * Status: 400 Bad Request
 * Note: This is a CLIENT BUG - malformed request body
 */
export class InvalidJsonError extends ApiError {
  constructor(message = 'Invalid JSON in request body') {
    super(message, ErrorCode.INVALID_JSON)
    this.name = 'InvalidJsonError'
  }
}

/**
 * Bad request error - generic client error.
 * Status: 400 Bad Request
 */
export class BadRequestError extends ApiError {
  constructor(message: string) {
    super(message, ErrorCode.BAD_REQUEST)
    this.name = 'BadRequestError'
  }
}

/**
 * Conflict error - resource already exists or state conflict.
 * Status: 409 Conflict
 */
export class ConflictError extends ApiError {
  constructor(message: string) {
    super(message, ErrorCode.CONFLICT)
    this.name = 'ConflictError'
  }
}

/**
 * Duplicate resource error - specific conflict for duplicates.
 * Status: 409 Conflict
 */
export class DuplicateResourceError extends ApiError {
  constructor(resource: string, field?: string) {
    const message = field
      ? `${resource} with this ${field} already exists`
      : `${resource} already exists`
    super(message, ErrorCode.DUPLICATE_RESOURCE)
    this.name = 'DuplicateResourceError'
  }
}

/**
 * Rate limit error - too many requests.
 * Status: 429 Too Many Requests
 */
export class RateLimitError extends ApiError {
  readonly retryAfter?: number

  constructor(message = 'Too many requests', retryAfter?: number) {
    super(message, ErrorCode.RATE_LIMITED)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

/**
 * Database error - Supabase operation failed.
 * Status: 500 Internal Server Error
 * Note: Raw DB errors are logged server-side but NEVER sent to client
 */
export class DatabaseError extends ApiError {
  readonly originalError?: Error

  constructor(message = 'Database operation failed', originalError?: Error) {
    super(message, ErrorCode.DATABASE_ERROR)
    this.name = 'DatabaseError'
    this.originalError = originalError
  }
}

/**
 * External service error - third-party API failed.
 * Status: 500 Internal Server Error
 */
export class ExternalServiceError extends ApiError {
  readonly service: string

  constructor(service: string, message?: string) {
    super(message || `${service} service error`, ErrorCode.EXTERNAL_SERVICE_ERROR)
    this.name = 'ExternalServiceError'
    this.service = service
  }
}
