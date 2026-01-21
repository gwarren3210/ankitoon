import { describe, it } from 'bun:test'
import sharp from 'sharp'
import { callOcrSpaceApi, detectImageFormat } from '@/lib/pipeline/ocr'
import { logger } from '@/lib/logger'

/**
 * OCR.space Engine 2 Pixel Limit Tests
 *
 * Uses binary search to efficiently determine exact dimensional limits
 * for OCR.space API with scale=true and scale=false.
 *
 * Tests OCR.space limits DIRECTLY by calling callOcrSpaceApi(),
 * bypassing processImage() tiling logic.
 *
 * Expected limits (from documentation):
 * - Width: 5000px max
 * - Height: 5000px max
 * - With scale=true: Upscaling ~2x, so safe threshold around 2500px
 * - With scale=false: Should work up to 5000px
 */

const API_KEY = process.env.OCR_API_KEY || ''
const SEARCH_PRECISION = 100 // Stop when range narrows to 100px
const MIN_DIMENSION = 1000   // Start at reasonable size
const MAX_DIMENSION = 8000   // Test beyond 5000px documented limit

interface BinarySearchResult {
  largestSuccess: number
  smallestFailure: number | null
  apiCalls: number
}

/**
 * Generate a test image with text (not solid white).
 * Input: width, height
 * Output: PNG buffer, or null if Sharp cannot create the image
 */
async function createTestImage(
  width: number,
  height: number
): Promise<Buffer | null> {
  logger.debug({ width, height }, 'Generating test image')

  try {
    // Create SVG with text to prevent excessive compression
    const svg = `
      <svg width="${width}" height="${height}">
        <rect width="100%" height="100%" fill="white"/>
        <text x="50%" y="50%" font-size="48" text-anchor="middle" fill="black">
          TEST ${width}x${height}
        </text>
      </svg>
    `

    return await sharp(Buffer.from(svg))
      .png()
      .toBuffer()
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)

    if (errorMsg.includes('exceeds pixel limit')) {
      logger.info(
        { width, height },
        'Sharp cannot create image - exceeds Sharp pixel limit'
      )
      return null
    }

    // Other Sharp errors should propagate
    throw error
  }
}

/**
 * Test if a specific dimension passes OCR processing.
 * Calls OCR.space API DIRECTLY, bypassing tiling logic.
 * Input: width, height, scale setting
 * Output: true if succeeds, false if exceeds OCR.space pixel limit
 */
async function testDimension(
  width: number,
  height: number,
  scale: boolean
): Promise<boolean> {
  const buffer = await createTestImage(width, height)

  // Check if Sharp could create the image
  if (!buffer) {
    logger.info(
      { width, height, scale },
      'Dimension test FAILED - Sharp cannot create image'
    )
    return false
  }

  // Convert to base64
  const format = detectImageFormat(buffer)
  const base64Image = `data:${format.mimeType};base64,${buffer.toString('base64')}`

  try {
    // Call OCR.space API directly (bypasses tiling logic in processImage)
    const response = await callOcrSpaceApi(base64Image, {
      apiKey: API_KEY,
      language: 'eng',
      ocrEngine: '2',
      scale: scale,
      isOverlayRequired: false,
      filetype: format.filetype
    })

    // Check if OCR.space returned an error (HTTP 200 but OCRExitCode !== 1)
    if (response.OCRExitCode !== 1) {
      logger.info(
        {
          width,
          height,
          scale,
          exitCode: response.OCRExitCode,
          errorMessage: response.ErrorMessage
        },
        'Dimension test FAILED - OCR.space returned error'
      )
      return false
    }

    logger.info(
      { width, height, scale, fileSize: buffer.length },
      'Dimension test PASSED'
    )
    return true
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)

    // Network/API errors
    logger.error(
      { width, height, scale, fileSize: buffer.length, error: errorMsg },
      'Dimension test FAILED - unexpected error'
    )
    throw error
  }
}

/**
 * Binary search to find maximum dimension that passes OCR.
 * Input: dimension type (square/height/width), scale setting
 * Output: largest successful dimension and smallest failure dimension
 */
async function findDimensionLimit(
  dimensionType: 'square' | 'height' | 'width',
  scale: boolean
): Promise<BinarySearchResult> {
  let low = MIN_DIMENSION
  let high = MAX_DIMENSION
  let largestSuccess = MIN_DIMENSION
  let smallestFailure: number | null = null
  let apiCalls = 0

  logger.info(
    {
      dimensionType,
      scale,
      searchRange: `${low}-${high}px`
    },
    'Starting binary search for dimension limit'
  )

  while (high - low > SEARCH_PRECISION) {
    const mid = Math.floor((low + high) / 2)

    // Determine test dimensions based on type
    const [width, height] = dimensionType === 'square'
      ? [mid, mid]
      : dimensionType === 'height'
        ? [1000, mid]
        : [mid, 1000]

    apiCalls++
    logger.debug(
      {
        iteration: apiCalls,
        testing: `${width}x${height}`,
        searchRange: `${low}-${high}px`
      },
      'Binary search iteration'
    )

    const success = await testDimension(width, height, scale)

    if (success) {
      largestSuccess = mid
      low = mid + 1 // Search higher
    } else {
      smallestFailure = mid
      high = mid - 1 // Search lower
    }

    // Add delay to respect API rate limits
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  logger.info(
    {
      dimensionType,
      scale,
      largestSuccess,
      smallestFailure,
      apiCallsUsed: apiCalls
    },
    'Binary search complete'
  )

  return { largestSuccess, smallestFailure, apiCalls }
}

describe('OCR.space Pixel Limits - Binary Search', () => {
  if (!API_KEY) {
    console.warn('OCR_API_KEY not set, skipping pixel limit tests')
    return
  }

  it.skip('should find square dimension limit with scale=true', async () => {
    console.log('\n=== Testing Square Dimensions with scale=true ===')

    const result = await findDimensionLimit('square', true)

    console.log(`\nResults:`)
    console.log(`  Largest successful: ${result.largestSuccess}x${result.largestSuccess}`)
    console.log(`  Smallest failure: ${result.smallestFailure ? `${result.smallestFailure}x${result.smallestFailure}` : 'N/A'}`)
    console.log(`  API calls used: ${result.apiCalls}`)
    console.log(`  Expected: ~2400-2600px (since 2x upscale → ~5000px limit)`)
  }, 600000) // 10 minute timeout

  it.skip('should find square dimension limit with scale=false', async () => {
    console.log('\n=== Testing Square Dimensions with scale=false ===')

    const result = await findDimensionLimit('square', false)

    console.log(`\nResults:`)
    console.log(`  Largest successful: ${result.largestSuccess}x${result.largestSuccess}`)
    console.log(`  Smallest failure: ${result.smallestFailure ? `${result.smallestFailure}x${result.smallestFailure}` : 'N/A'}`)
    console.log(`  API calls used: ${result.apiCalls}`)
    console.log(`  Expected: ~4900-5000px (at documented limit)`)
  }, 600000)

  it.skip('should find height limit with scale=true (tall images)', async () => {
    console.log('\n=== Testing Height Limit with scale=true ===')
    console.log('(Fixed width: 1000px, varying height)')

    const result = await findDimensionLimit('height', true)

    console.log(`\nResults:`)
    console.log(`  Largest successful: 1000x${result.largestSuccess}`)
    console.log(`  Smallest failure: ${result.smallestFailure ? `1000x${result.smallestFailure}` : 'N/A'}`)
    console.log(`  API calls used: ${result.apiCalls}`)
    console.log(`  Expected: ~2400-2600px height`)
  }, 600000)

  it('should find height limit with scale=false (tall images)', async () => {
    console.log('\n=== Testing Height Limit with scale=false ===')
    console.log('(Fixed width: 1000px, varying height)')

    const result = await findDimensionLimit('height', false)

    console.log(`\nResults:`)
    console.log(`  Largest successful: 1000x${result.largestSuccess}`)
    console.log(`  Smallest failure: ${result.smallestFailure ? `1000x${result.smallestFailure}` : 'N/A'}`)
    console.log(`  API calls used: ${result.apiCalls}`)
    console.log(`  Expected: ~4900-5000px height (typical stitched webtoon)`)
  }, 600000)

  it.skip('should find width limit with scale=true', async () => {
    console.log('\n=== Testing Width Limit with scale=true ===')
    console.log('(Fixed height: 1000px, varying width)')

    const result = await findDimensionLimit('width', true)

    console.log(`\nResults:`)
    console.log(`  Largest successful: ${result.largestSuccess}x1000`)
    console.log(`  Smallest failure: ${result.smallestFailure ? `${result.smallestFailure}x1000` : 'N/A'}`)
    console.log(`  API calls used: ${result.apiCalls}`)
    console.log(`  Expected: ~2400-2600px width`)
  }, 600000)

  it.skip('should find width limit with scale=false', async () => {
    console.log('\n=== Testing Width Limit with scale=false ===')
    console.log('(Fixed height: 1000px, varying width)')

    const result = await findDimensionLimit('width', false)

    console.log(`\nResults:`)
    console.log(`  Largest successful: ${result.largestSuccess}x1000`)
    console.log(`  Smallest failure: ${result.smallestFailure ? `${result.smallestFailure}x1000` : 'N/A'}`)
    console.log(`  API calls used: ${result.apiCalls}`)
    console.log(`  Expected: ~4900-5000px width`)
  }, 600000)
})
