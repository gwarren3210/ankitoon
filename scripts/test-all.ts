#!/usr/bin/env bun

/**
 * Test Runner Script
 *
 * Runs all test batches in isolation and provides a unified report.
 * Handles Bun's mock.module() isolation requirements.
 */

import { spawn } from 'child_process'
import { testBatches } from './test-batches'

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  dim: '\x1b[2m'
}

interface BatchResult {
  name: string
  passed: boolean
  duration: number
  tests: number
  failures: number
}

/**
 * Run a test batch
 */
async function runBatch(
  batch: { name: string; files: string[] },
  batchIndex: number
): Promise<BatchResult> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()

    console.log(
      `${colors.cyan}[${batchIndex}/${testBatches.length}]${colors.reset} ${colors.dim}Running${colors.reset} ${colors.bright}${batch.name}${colors.reset}...`
    )

    const proc = spawn('bun', ['test', ...batch.files], {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: process.env
    })

    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (data) => {
      const output = data.toString()
      stdout += output
      // Optionally show live output
      if (process.env.VERBOSE) {
        process.stdout.write(output)
      }
    })

    proc.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      const duration = Date.now() - startTime

      // Combine stdout and stderr for parsing
      const output = stdout + stderr

      // Parse test results from output
      let tests = 0
      let failures = 0

      const passMatch = output.match(/(\d+) pass/)
      const failMatch = output.match(/(\d+) fail/)
      const ranMatch = output.match(/Ran (\d+) tests/)

      if (passMatch) tests = parseInt(passMatch[1], 10)
      if (failMatch) failures = parseInt(failMatch[1], 10)
      if (ranMatch && !passMatch) tests = parseInt(ranMatch[1], 10)

      if (code === 0) {
        console.log(
          `${colors.dim}  →${colors.reset} ${colors.green}✓ ${tests} tests${colors.reset} ${colors.dim}(${duration}ms)${colors.reset}\n`
        )
        resolve({
          name: batch.name,
          passed: true,
          duration,
          tests,
          failures: 0
        })
      } else {
        const failCount = failures > 0 ? failures : 'some'
        console.error(
          `${colors.dim}  →${colors.reset} ${colors.red}✗ ${failCount} failures${colors.reset} ${colors.dim}(${duration}ms)${colors.reset}\n`
        )
        if (output) {
          // Show relevant error lines
          const errorLines = output.split('\n').filter(l =>
            l.includes('error:') || l.includes('Error') || l.includes('fail')
          )
          if (errorLines.length > 0) {
            console.error(colors.dim + errorLines.slice(0, 5).join('\n') + colors.reset)
          }
        }
        resolve({
          name: batch.name,
          passed: false,
          duration,
          tests,
          failures
        })
      }
    })

    proc.on('error', (err) => {
      reject(err)
    })
  })
}

/**
 * Generate summary report
 */
function generateSummary(results: BatchResult[]): void {
  const totalTests = results.reduce((sum, r) => sum + r.tests, 0)
  const totalFailures = results.reduce((sum, r) => sum + r.failures, 0)
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0)
  const allPassed = results.every((r) => r.passed)

  console.log(`${colors.bright}${'═'.repeat(60)}${colors.reset}`)
  console.log(`${colors.bright}Test Summary${colors.reset}`)
  console.log(`${colors.bright}${'═'.repeat(60)}${colors.reset}\n`)

  // Batch breakdown
  console.log(`${colors.bright}Batches:${colors.reset}`)
  results.forEach((result) => {
    const status = result.passed
      ? `${colors.green}✓${colors.reset}`
      : `${colors.red}✗${colors.reset}`
    const testCount = `${result.tests} tests`.padEnd(12)
    const time = `${result.duration}ms`.padStart(8)
    console.log(`  ${status} ${result.name.padEnd(30)} ${testCount} ${colors.dim}${time}${colors.reset}`)
  })

  // Overall stats
  console.log(`\n${colors.bright}Overall:${colors.reset}`)
  console.log(`  Total tests:  ${colors.cyan}${totalTests}${colors.reset}`)
  console.log(`  Passed:       ${colors.green}${totalTests - totalFailures}${colors.reset}`)
  if (totalFailures > 0) {
    console.log(`  Failed:       ${colors.red}${totalFailures}${colors.reset}`)
  }
  console.log(`  Duration:     ${colors.cyan}${totalDuration}ms${colors.reset} ${colors.dim}(${(totalDuration / 1000).toFixed(2)}s)${colors.reset}`)

  console.log(`\n${colors.bright}Result:${colors.reset}`)
  if (allPassed) {
    console.log(`  ${colors.green}${colors.bright}✓ All tests passed!${colors.reset}\n`)
  } else {
    console.log(`  ${colors.red}${colors.bright}✗ Some tests failed${colors.reset}\n`)
  }

  console.log(`${colors.bright}${'═'.repeat(60)}${colors.reset}\n`)
}

/**
 * Main execution
 */
async function main() {
  console.log(`\n${colors.bright}${colors.blue}AnkiToon Test Suite${colors.reset}`)
  console.log(`${colors.dim}Running tests in isolated batches...${colors.reset}\n`)

  const results: BatchResult[] = []
  let hasFailures = false

  try {
    // Run all test batches
    for (let i = 0; i < testBatches.length; i++) {
      const result = await runBatch(testBatches[i], i + 1)
      results.push(result)
      if (!result.passed) {
        hasFailures = true
      }
    }

    // Generate summary
    generateSummary(results)

    process.exit(hasFailures ? 1 : 0)
  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}✗ Test execution failed${colors.reset}`)
    console.error(error)
    process.exit(1)
  }
}

main()
