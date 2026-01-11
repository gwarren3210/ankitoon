/**
 * API Validation Helpers
 * Provides consistent request parsing and validation for API routes.
 */

import { NextRequest } from 'next/server'
import { ZodSchema, ZodError } from 'zod'
import { logger } from '@/lib/logger'
import { ValidationError, InvalidJsonError } from './errors'

/**
 * Formats a Zod error path into a human-readable string.
 * Input: PropertyKey array from Zod issue
 * Output: Dot-notation path string (e.g., "items[0].name")
 */
function formatZodPath(path: PropertyKey[]): string {
  return path
    .map((p, i) => {
      if (typeof p === 'number') return `[${p}]`
      if (typeof p === 'symbol') return `[${p.description || 'symbol'}]`
      return i === 0 ? p : `.${p}`
    })
    .join('')
}

/**
 * Formats Zod validation errors into human-friendly messages.
 * Input: ZodError object
 * Output: Array of readable error strings
 */
export function formatZodErrors(error: ZodError): string[] {
  return error.issues.map(issue => {
    const path = formatZodPath(issue.path)
    return path ? `${path}: ${issue.message}` : issue.message
  })
}

/**
 * Parses and validates request JSON body against a Zod schema.
 * IMPORTANT: Parse errors (INVALID_JSON) and validation errors (VALIDATION_ERROR)
 * are kept SEPARATE - they indicate different failure modes:
 * - INVALID_JSON = client bug (malformed request)
 * - VALIDATION_ERROR = user input issue (wrong shape/values)
 *
 * Input: NextRequest, Zod schema
 * Output: validated and typed request body
 */
export async function parseAndValidate<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<T> {
  // Step 1: Parse JSON (throws InvalidJsonError for malformed JSON)
  let body: unknown
  try {
    body = await request.json()
  } catch (error) {
    logger.warn({
      error: error instanceof Error ? error.message : String(error)
    }, 'Failed to parse request JSON')
    throw new InvalidJsonError()
  }

  // Step 2: Validate shape (throws ValidationError for invalid data)
  const result = schema.safeParse(body)
  if (!result.success) {
    logger.warn({
      issues: result.error.issues
    }, 'Request validation failed')
    throw new ValidationError(formatZodErrors(result.error))
  }

  return result.data
}

/**
 * Validates data against a Zod schema (no parsing).
 * Use when you already have the data and just need validation.
 * Input: data to validate, Zod schema
 * Output: validated data
 */
export function validate<T>(data: unknown, schema: ZodSchema<T>): T {
  const result = schema.safeParse(data)

  if (!result.success) {
    logger.warn({
      issues: result.error.issues
    }, 'Data validation failed')
    throw new ValidationError(formatZodErrors(result.error))
  }

  return result.data
}

/**
 * Safely parses FormData field as string.
 * Returns undefined if field is missing or null.
 * Input: FormData, field name
 * Output: string value or undefined
 */
export function getFormString(
  formData: FormData,
  field: string
): string | undefined {
  const value = formData.get(field)
  if (value === null || typeof value !== 'string') {
    return undefined
  }
  return value.trim() || undefined
}

/**
 * Safely parses FormData field as number.
 * Returns undefined if field is missing, null, or not a valid number.
 * Input: FormData, field name
 * Output: number value or undefined
 */
export function getFormNumber(
  formData: FormData,
  field: string
): number | undefined {
  const value = formData.get(field)
  if (value === null || typeof value !== 'string') {
    return undefined
  }
  const num = parseInt(value, 10)
  return isNaN(num) ? undefined : num
}

/**
 * Safely gets File from FormData.
 * Returns undefined if field is missing or not a File.
 * Input: FormData, field name
 * Output: File or undefined
 */
export function getFormFile(
  formData: FormData,
  field: string
): File | undefined {
  const value = formData.get(field)
  if (value === null || !(value instanceof File)) {
    return undefined
  }
  return value.size > 0 ? value : undefined
}
