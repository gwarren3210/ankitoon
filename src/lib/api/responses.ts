/**
 * API Response Helpers
 * Provides consistent response formatting for API routes.
 */

import { NextResponse } from 'next/server'

/**
 * Creates a successful JSON response.
 * Input: response data, optional status code (default 200)
 * Output: NextResponse with JSON body
 */
export function successResponse<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status })
}

/**
 * Creates a 201 Created response.
 * Input: created resource data
 * Output: NextResponse with 201 status
 */
export function createdResponse<T>(data: T): NextResponse<T> {
  return NextResponse.json(data, { status: 201 })
}

/**
 * Creates a 204 No Content response.
 * Input: none
 * Output: NextResponse with 204 status and no body
 */
export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 })
}
