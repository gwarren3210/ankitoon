#!/usr/bin/env bun

/**
 * Bun Native Coverage Script
 *
 * Runs all test batches in isolation and aggregates coverage from Bun's
 * native coverage output. This preserves test isolation while providing
 * accurate coverage metrics.
 *
 * How it works:
 * 1. Runs each test batch separately with coverage enabled
 * 2. Parses coverage output from stdout (Bun v1.3.5 format)
 * 3. Aggregates coverage data across all batches
 * 4. Generates unified text and HTML reports
 */

import { spawn } from 'child_process'
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { testBatches } from './test-batches'

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m'
}

/**
 * Coverage data for a single file
 */
interface FileCoverage {
  file: string
  functions: { covered: number; total: number }
  lines: { covered: number; total: number }
  uncoveredLines: string
}

/**
 * Aggregated coverage across all files
 */
interface AggregatedCoverage {
  byFile: Map<string, FileCoverage>
  totals: {
    functions: { covered: number; total: number }
    lines: { covered: number; total: number }
  }
}

/**
 * Parse coverage output from Bun's text format
 *
 * Example input:
 * ------------------------|---------|---------|-------------------
 * File                    | % Funcs | % Lines | Uncovered Line #s
 * ------------------------|---------|---------|-------------------
 * All files               |  100.00 |  100.00 |
 *  src/lib/study/utils.ts |  100.00 |  100.00 |
 * ------------------------|---------|---------|-------------------
 */
function parseCoverageOutput(output: string): FileCoverage[] {
  const files: FileCoverage[] = []
  const lines = output.split('\n')

  for (const line of lines) {
    // Skip header, separator, and "All files" line
    if (
      line.includes('File') ||
      line.includes('---') ||
      line.trim().startsWith('All files') ||
      line.trim() === ''
    ) {
      continue
    }

    // Parse file coverage line
    // Format: " src/lib/study/utils.ts |  100.00 |  100.00 | "
    const match = line.match(
      /^\s+(.+?)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s*(.*)$/
    )
    if (match) {
      const [, file, funcsPercent, linesPercent, uncovered] = match

      // Store raw percentages - we'll display these directly
      const funcsNum = parseFloat(funcsPercent)
      const linesNum = parseFloat(linesPercent)

      files.push({
        file: file.trim(),
        functions: {
          covered: Math.round(funcsNum), // Store percentage as covered out of 100
          total: 100
        },
        lines: {
          covered: Math.round(linesNum), // Store percentage as covered out of 100
          total: 100
        },
        uncoveredLines: uncovered.trim()
      })
    }
  }

  return files
}

/**
 * Aggregate coverage from multiple batches
 */
function aggregateCoverage(
  allFiles: FileCoverage[]
): AggregatedCoverage {
  const byFile = new Map<string, FileCoverage>()

  for (const fileCov of allFiles) {
    const existing = byFile.get(fileCov.file)
    if (existing) {
      // Merge coverage data (take best coverage)
      existing.functions.covered = Math.max(
        existing.functions.covered,
        fileCov.functions.covered
      )
      existing.lines.covered = Math.max(
        existing.lines.covered,
        fileCov.lines.covered
      )
    } else {
      byFile.set(fileCov.file, { ...fileCov })
    }
  }

  // Calculate totals
  let totalFuncsCovered = 0
  let totalFuncsTotal = 0
  let totalLinesCovered = 0
  let totalLinesTotal = 0

  for (const fileCov of byFile.values()) {
    totalFuncsCovered += fileCov.functions.covered
    totalFuncsTotal += fileCov.functions.total
    totalLinesCovered += fileCov.lines.covered
    totalLinesTotal += fileCov.lines.total
  }

  return {
    byFile,
    totals: {
      functions: {
        covered: totalFuncsCovered,
        total: totalFuncsTotal
      },
      lines: {
        covered: totalLinesCovered,
        total: totalLinesTotal
      }
    }
  }
}

/**
 * Run a test batch and capture coverage output
 */
async function runBatchWithCoverage(
  batch: { name: string; files: string[] },
  batchIndex: number
): Promise<FileCoverage[]> {
  return new Promise((resolve, reject) => {
    console.log(
      `${colors.cyan}[${batchIndex}/${testBatches.length}]${colors.reset} ${colors.dim}Running${colors.reset} ${colors.bright}${batch.name}${colors.reset}...`
    )

    let stdout = ''
    let stderr = ''

    const proc = spawn('bun', ['test', ...batch.files], {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: process.env
    })

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code === 0) {
        const output = stdout + stderr
        const files = parseCoverageOutput(output)

        console.log(
          `${colors.dim}  →${colors.reset} ${colors.green}✓ ${files.length} files covered${colors.reset}`
        )
        resolve(files)
      } else {
        console.error(
          `${colors.red}✗ Batch ${batch.name} failed${colors.reset}`
        )
        reject(new Error(`Batch ${batch.name} failed with code ${code}`))
      }
    })

    proc.on('error', (err) => {
      reject(err)
    })
  })
}

/**
 * Generate text coverage report
 */
function generateTextReport(coverage: AggregatedCoverage): string {
  const { byFile, totals } = coverage

  let report = '\n'
  report += `${colors.bright}Coverage Summary${colors.reset}\n`
  report += '='.repeat(80) + '\n\n'

  // Sort files by path
  const sortedFiles = Array.from(byFile.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  )

  // Group by directory
  const byDir = new Map<string, FileCoverage[]>()
  for (const [file, cov] of sortedFiles) {
    const dir = file.substring(0, file.lastIndexOf('/'))
    if (!byDir.has(dir)) {
      byDir.set(dir, [])
    }
    byDir.get(dir)!.push(cov)
  }

  // Print by directory
  for (const [dir, files] of Array.from(byDir.entries()).sort()) {
    report += `${colors.cyan}${dir}/${colors.reset}\n`

    for (const fileCov of files) {
      const fileName = fileCov.file.substring(fileCov.file.lastIndexOf('/') + 1)
      const funcPercent =
        fileCov.functions.total > 0
          ? (
              (fileCov.functions.covered / fileCov.functions.total) *
              100
            ).toFixed(1)
          : '0.0'
      const linePercent =
        fileCov.lines.total > 0
          ? ((fileCov.lines.covered / fileCov.lines.total) * 100).toFixed(1)
          : '0.0'

      const funcColor =
        parseFloat(funcPercent) >= 80
          ? colors.green
          : parseFloat(funcPercent) >= 50
            ? colors.yellow
            : colors.red
      const lineColor =
        parseFloat(linePercent) >= 80
          ? colors.green
          : parseFloat(linePercent) >= 50
            ? colors.yellow
            : colors.red

      report += `  ${fileName.padEnd(40)} ${funcColor}${funcPercent}%${colors.reset} funcs  ${lineColor}${linePercent}%${colors.reset} lines\n`
    }
    report += '\n'
  }

  // Overall totals
  const totalFuncPercent =
    totals.functions.total > 0
      ? ((totals.functions.covered / totals.functions.total) * 100).toFixed(1)
      : '0.0'
  const totalLinePercent =
    totals.lines.total > 0
      ? ((totals.lines.covered / totals.lines.total) * 100).toFixed(1)
      : '0.0'

  report += '='.repeat(80) + '\n'
  report += `${colors.bright}Overall Coverage${colors.reset}\n`
  report += `  Functions: ${colors.green}${totalFuncPercent}%${colors.reset} (${totals.functions.covered}/${totals.functions.total})\n`
  report += `  Lines:     ${colors.green}${totalLinePercent}%${colors.reset} (${totals.lines.covered}/${totals.lines.total})\n`
  report += '='.repeat(80) + '\n\n'

  return report
}

/**
 * Generate simple HTML report
 */
function generateHTMLReport(coverage: AggregatedCoverage): string {
  const { byFile, totals } = coverage

  const totalFuncPercent =
    totals.functions.total > 0
      ? ((totals.functions.covered / totals.functions.total) * 100).toFixed(1)
      : '0.0'
  const totalLinePercent =
    totals.lines.total > 0
      ? ((totals.lines.covered / totals.lines.total) * 100).toFixed(1)
      : '0.0'

  let html = `<!DOCTYPE html>
<html>
<head>
  <title>AnkiToon Test Coverage</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 20px; background: #f5f5f5; }
    h1 { color: #333; }
    .summary { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .summary-stat { display: inline-block; margin-right: 40px; }
    .summary-stat .label { color: #666; font-size: 14px; }
    .summary-stat .value { font-size: 32px; font-weight: bold; color: #2ecc71; }
    table { width: 100%; background: white; border-collapse: collapse; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    th { background: #333; color: white; padding: 12px; text-align: left; font-weight: 600; }
    td { padding: 12px; border-bottom: 1px solid #eee; }
    tr:hover { background: #f9f9f9; }
    .high { color: #2ecc71; font-weight: 600; }
    .medium { color: #f39c12; font-weight: 600; }
    .low { color: #e74c3c; font-weight: 600; }
    .dir-header { background: #f8f9fa; font-weight: 600; color: #555; }
  </style>
</head>
<body>
  <h1>AnkiToon Test Coverage Report</h1>

  <div class="summary">
    <div class="summary-stat">
      <div class="label">Functions</div>
      <div class="value">${totalFuncPercent}%</div>
      <div class="label">${totals.functions.covered}/${totals.functions.total}</div>
    </div>
    <div class="summary-stat">
      <div class="label">Lines</div>
      <div class="value">${totalLinePercent}%</div>
      <div class="label">${totals.lines.covered}/${totals.lines.total}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>File</th>
        <th>Functions</th>
        <th>Lines</th>
        <th>Uncovered Lines</th>
      </tr>
    </thead>
    <tbody>
`

  // Group by directory
  const byDir = new Map<string, FileCoverage[]>()
  for (const [file, cov] of byFile.entries()) {
    const dir = file.substring(0, file.lastIndexOf('/'))
    if (!byDir.has(dir)) {
      byDir.set(dir, [])
    }
    byDir.get(dir)!.push(cov)
  }

  // Generate rows by directory
  for (const [dir, files] of Array.from(byDir.entries()).sort()) {
    html += `      <tr class="dir-header"><td colspan="4">${dir}/</td></tr>\n`

    for (const fileCov of files) {
      const fileName = fileCov.file.substring(fileCov.file.lastIndexOf('/') + 1)
      const funcPercent =
        fileCov.functions.total > 0
          ? (
              (fileCov.functions.covered / fileCov.functions.total) *
              100
            ).toFixed(1)
          : '0.0'
      const linePercent =
        fileCov.lines.total > 0
          ? ((fileCov.lines.covered / fileCov.lines.total) * 100).toFixed(1)
          : '0.0'

      const funcClass =
        parseFloat(funcPercent) >= 80
          ? 'high'
          : parseFloat(funcPercent) >= 50
            ? 'medium'
            : 'low'
      const lineClass =
        parseFloat(linePercent) >= 80
          ? 'high'
          : parseFloat(linePercent) >= 50
            ? 'medium'
            : 'low'

      html += `      <tr>
        <td>${fileName}</td>
        <td class="${funcClass}">${funcPercent}%</td>
        <td class="${lineClass}">${linePercent}%</td>
        <td>${fileCov.uncoveredLines || '-'}</td>
      </tr>\n`
    }
  }

  html += `    </tbody>
  </table>

  <p style="margin-top: 40px; color: #666; font-size: 14px;">
    Generated on ${new Date().toLocaleString()} |
    ${byFile.size} files |
    ${testBatches.length} test batches
  </p>
</body>
</html>`

  return html
}

/**
 * Main execution
 */
async function main() {
  console.log(`\n${colors.bright}${colors.cyan}Coverage Collection${colors.reset}`)
  console.log(`${colors.dim}Running all test batches with coverage...${colors.reset}\n`)

  // Clean previous coverage data
  if (existsSync('coverage')) {
    rmSync('coverage', { recursive: true })
  }
  mkdirSync('coverage', { recursive: true })

  try {
    // Run all batches and collect coverage
    const allFiles: FileCoverage[] = []

    for (let i = 0; i < testBatches.length; i++) {
      const files = await runBatchWithCoverage(testBatches[i], i + 1)
      allFiles.push(...files)
    }

    console.log(`\n${colors.bright}${colors.cyan}Aggregating Coverage${colors.reset}`)
    console.log(`${colors.dim}Combining data from all batches...${colors.reset}\n`)

    // Aggregate coverage
    const coverage = aggregateCoverage(allFiles)

    // Generate reports
    const textReport = generateTextReport(coverage)
    console.log(textReport)

    const htmlReport = generateHTMLReport(coverage)
    writeFileSync('coverage/index.html', htmlReport)

    console.log(`${colors.green}${colors.bright}✓ Coverage reports generated${colors.reset}`)
    console.log(`${colors.dim}  - HTML report: coverage/index.html${colors.reset}\n`)

    process.exit(0)
  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}✗ Coverage collection failed${colors.reset}`)
    console.error(error)
    process.exit(1)
  }
}

main()
