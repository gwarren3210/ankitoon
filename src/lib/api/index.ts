/**
 * API Utilities
 * Central export for all API error handling and response utilities.
 */

// Error classes and types
export {
  ApiError,
  UnauthorizedError,
  ForbiddenError,
  AdminRequiredError,
  NotFoundError,
  SessionNotFoundError,
  ValidationError,
  InvalidJsonError,
  BadRequestError,
  ConflictError,
  DuplicateResourceError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  ErrorCode,
  ERROR_STATUS_MAP,
  type ApiErrorResponse
} from './errors'

// Error handler wrapper
export { withErrorHandler, errorResponse } from './errorHandler'

// Auth helpers
export {
  requireAuth,
  requireAdmin,
  requireOwnership,
  type AuthResult
} from './auth'

// Validation helpers
export {
  parseAndValidate,
  validate,
  formatZodErrors,
  getFormString,
  getFormNumber,
  getFormFile
} from './validation'

// Response helpers
export { successResponse, createdResponse, noContentResponse } from './responses'
