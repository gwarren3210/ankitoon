Run the test suite and help fix any failures.

## Instructions

1. Run unit tests only (exclude integration and e2e tests):
   ```bash
   bun test --exclude "**/*.integration.test.ts" --exclude "**/*-e2e.test.ts"
   ```

2. If tests fail, analyze the failures with full context:
   - Read the failing test file to understand what's being tested
   - Read the source file being tested to understand the implementation
   - Identify the root cause (test issue vs implementation bug)

3. For each failure, provide:
   - What the test expects vs what it got
   - Why the mismatch occurred
   - A fix (either to the test or the implementation)

4. After fixing, re-run tests to confirm the fix works

## Project Context

- Tests are located in `src/lib/pipeline/__tests__/`
- Uses Bun test runner (not Jest)
- Key test utilities are in `src/lib/test-utils/fixtures.ts`

## Important: Excluded Tests

By default, these tests are EXCLUDED (require external APIs):
- `*.integration.test.ts` - OCR.space, Gemini API calls
- `*-e2e.test.ts` - End-to-end tests needing full pipeline

Specifically excluded files:
- `ocr.integration.test.ts` - OCR.space API
- `translator.integration.test.ts` - Gemini API
- `zip-ocr.integration.test.ts` - OCR.space API
- `zip-gemini.integration.test.ts` - Gemini API
- `solo-leveling-pipeline.integration.test.ts` - Full pipeline
- `row-images.integration.test.ts` - Image processing + APIs
- `tiling-ocr-e2e.test.ts` - Full tiling + OCR pipeline

## Optional Arguments

- No arguments: Run unit tests only (default)
- `--integration` or `integration`: Include integration tests
- `<pattern>`: Run tests matching the pattern
- `--watch`: Run in watch mode

$ARGUMENTS
