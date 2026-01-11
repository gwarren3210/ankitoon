/**
 * API Error Handler Wrapper
 * Provides consistent error handling and response formatting for API routes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import pino from 'pino'
import { logger } from '@/lib/logger'
import {
  ApiError,
  ApiErrorResponse,
  ErrorCode,
  RateLimitError
} from './errors'

// Type for child logger - use base pino Logger type for compatibility
type ChildLogger = pino.Logger

type RouteHandler = (
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) => Promise<NextResponse>

/**
 * Configuration for error handler wrapper.
 */
interface ErrorHandlerOptions {
  /** Include request ID in responses (default: true) */
  includeRequestId?: boolean
  /** Custom error transformer for specific error types */
  transformError?: (error: unknown) => ApiError | null
}

/**
 * Wraps an API route handler with consistent error handling.
 * Input: route handler function, optional configuration
 * Output: wrapped handler with try-catch and formatted responses
 */
export function withErrorHandler(
  handler: RouteHandler,
  options: ErrorHandlerOptions = {}
): RouteHandler {
  const { includeRequestId = true, transformError } = options

  return async (
    request: NextRequest,
    context?: { params?: Promise<Record<string, string>> }
  ) => {
    const requestId = includeRequestId ? randomUUID() : undefined
    const startTime = Date.now()

    // Create scoped logger with request context
    const requestLogger = logger.child({
      requestId,
      method: request.method,
      path: request.nextUrl.pathname
    })

    try {
      requestLogger.debug('Request started')
      const response = await handler(request, context)

      requestLogger.info({
        statusCode: response.status,
        durationMs: Date.now() - startTime
      }, 'Request completed')

      return response
    } catch (error) {
      return handleError(error, requestId, requestLogger, transformError)
    }
  }
}

/**
 * Converts an error to a formatted NextResponse.
 * Input: error, request ID, logger, optional transformer
 * Output: NextResponse with ApiErrorResponse body
 */
function handleError(
  error: unknown,
  requestId: string | undefined,
  requestLogger: ChildLogger,
  transformError?: (error: unknown) => ApiError | null
): NextResponse {
  // Try custom transformer first
  if (transformError) {
    const transformed = transformError(error)
    if (transformed) {
      return formatApiErrorResponse(transformed, requestId, requestLogger)
    }
  }

  // Handle known API errors
  if (error instanceof ApiError) {
    return formatApiErrorResponse(error, requestId, requestLogger)
  }

  // Handle unknown errors - NEVER leak internal details
  return formatUnknownErrorResponse(error, requestId, requestLogger)
}

/**
 * Formats an ApiError into a NextResponse.
 * Input: ApiError, request ID, logger
 * Output: NextResponse with appropriate status and body
 */
function formatApiErrorResponse(
  error: ApiError,
  requestId: string | undefined,
  requestLogger: ChildLogger
): NextResponse {
  const isServerError = error.statusCode >= 500
  const isDevelopment = process.env.NODE_ENV === 'development'

  // Log with appropriate level: warn for client errors, error for server errors
  if (isServerError) {
    requestLogger.error({
      errorCode: error.code,
      errorName: error.name,
      statusCode: error.statusCode,
      stack: error.stack
    }, error.message)
  } else {
    requestLogger.warn({
      errorCode: error.code,
      errorName: error.name,
      statusCode: error.statusCode
    }, error.message)
  }

  const body: ApiErrorResponse = {
    error: error.message,
    code: error.code,
    ...(error.details && error.details.length > 0 && { details: error.details }),
    ...(isDevelopment && isServerError && { debug: error.stack }),
    ...(requestId && { requestId })
  }

  const headers: HeadersInit = {}

  // Add Retry-After header for rate limit errors
  if (error instanceof RateLimitError && error.retryAfter) {
    headers['Retry-After'] = String(error.retryAfter)
  }

  return NextResponse.json(body, {
    status: error.statusCode,
    headers
  })
}

/**
 * Formats an unknown error into a NextResponse.
 * SECURITY: Raw error details are logged server-side but NEVER sent to client.
 * Input: unknown error, request ID, logger
 * Output: NextResponse with 500 status and generic message
 */
function formatUnknownErrorResponse(
  error: unknown,
  requestId: string | undefined,
  requestLogger: ChildLogger
): NextResponse {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined

  // Log FULL error details server-side for debugging
  requestLogger.error({
    errorType: error instanceof Error ? error.constructor.name : typeof error,
    message: errorMessage,
    stack: errorStack
    // Raw Postgres error details, table names, etc. logged here but NEVER sent
  }, `Unhandled error: ${errorMessage}`)

  // Return GENERIC message to client - never leak internal details
  const body: ApiErrorResponse = {
    error: 'Internal server error',
    code: ErrorCode.INTERNAL_ERROR,
    ...(isDevelopment && { debug: errorStack || errorMessage }),
    ...(requestId && { requestId })
  }

  return NextResponse.json(body, { status: 500 })
}

/**
 * Standalone function to format error responses.
 * Use when you need to return an error without throwing.
 * Input: ApiError or error parameters
 * Output: NextResponse
 */
export function errorResponse(
  error: ApiError,
  requestId?: string
): NextResponse {
  const body: ApiErrorResponse = {
    error: error.message,
    code: error.code,
    ...(error.details && error.details.length > 0 && { details: error.details }),
    ...(requestId && { requestId })
  }

  return NextResponse.json(body, { status: error.statusCode })
}
