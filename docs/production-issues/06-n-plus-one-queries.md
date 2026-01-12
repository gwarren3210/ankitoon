# Production Issue #6: N+1 Query Pattern

**Severity:** MEDIUM 🟡
**Impact:** Medium - Performance degradation, slow page loads
**Affected File:** `src/lib/content/services/seriesService.ts`
**Lines:** 120-136

---

## Problem Description

The `getSeriesVocabularyStatsBatch()` function has an **N+1 query
problem** that makes unnecessary database round-trips when fetching
vocabulary statistics for multiple series.

### What is an N+1 Query?

An N+1 query problem occurs when you:
1. Make 1 query to fetch N items
2. Make N additional queries to fetch related data for each item

**Total: 1 + N queries** (should be just 1 or 2 queries)

### Current Implementation

```typescript
// src/lib/content/services/seriesService.ts (lines 120-136)
export async function getSeriesVocabularyStatsBatch(
  seriesIds: string[]
): Promise<Map<string, VocabularyStats>> {
  const statsMap = new Map<string, VocabularyStats>()

  // ❌ PROBLEM: Loops through each series
  for (const seriesId of seriesIds) {
    // ❌ PROBLEM: Queries database for each series individually
    const chapters = await getChaptersBySeriesId(seriesId)

    let totalWords = 0
    for (const chapter of chapters) {
      const { data: vocabCount } = await supabase
        .from('chapter_vocabulary')
        .select('vocabulary_id', { count: 'exact', head: true })
        .eq('chapter_slug', chapter.slug)

      totalWords += vocabCount?.count ?? 0
    }

    statsMap.set(seriesId, { totalWords })
  }

  return statsMap
}
```

### Performance Impact

**With 100 series:**
```
Query 1: Fetch 100 series IDs ✅
Query 2-101: Fetch chapters for series 1-100 ❌ (100 queries)
Query 102-N: Fetch vocab counts for each chapter ❌ (hundreds more)

Total queries: 300+ queries
Total time: 300 queries × 50ms latency = 15 seconds
```

**Should be:**
```
Query 1: Fetch all chapters for all series ✅ (1 query with IN clause)
Query 2: Fetch all vocab counts ✅ (1 query with JOIN)

Total queries: 2 queries
Total time: 2 × 50ms = 100ms (150x faster!)
```

---

## Why This Matters

### User Experience Impact

**Scenario: User views "Browse Series" page**

```
Current implementation:
1. Page loads
2. Waits 15 seconds for vocab stats
3. User sees loading spinner
4. User thinks app is broken
5. User closes tab

Optimized implementation:
1. Page loads
2. Stats load in 100ms
3. User immediately sees content
4. User stays engaged
```

### Scalability Impact

| Series Count | Queries | Latency | Database Load |
|-------------|---------|---------|---------------|
| 10 series   | ~30     | 1.5s    | Acceptable    |
| 50 series   | ~150    | 7.5s    | Poor UX       |
| 100 series  | ~300    | 15s     | Timeout risk  |
| 1000 series | ~3000   | 150s    | System crash  |

**As your catalog grows, the problem gets exponentially worse.**

### Database Connection Pool Exhaustion

```
100 concurrent users × 300 queries each = 30,000 queries
Supabase connection limit: 50-100 connections
Result: Connection pool exhausted, all requests hang
```

### Cost Impact

**Supabase Pricing:**
- Database CPU time billed per query
- 300 queries cost 150x more than 2 queries
- Could push you into higher pricing tier

---

## Root Cause Analysis

### Why This Happens

1. **Sequential Processing**
   - Loops through series one by one
   - Each iteration waits for previous to complete

2. **Per-Item Queries**
   - `getChaptersBySeriesId()` called N times
   - Each call makes separate database round-trip

3. **Nested Loops**
   - Outer loop: series
   - Inner loop: chapters
   - Multiplicative query count

### Code Smell Indicators

```typescript
// 🚩 RED FLAG: Loop with await inside
for (const item of items) {
  const data = await fetchSomething(item.id)  // ❌ N+1 query
}

// ✅ CORRECT: Batch fetch outside loop
const allData = await fetchAll(items.map(i => i.id))
for (const item of items) {
  const data = allData.get(item.id)  // ✅ O(1) lookup
}
```

---

## Recommended Solution

### Strategy: Batch Queries with IN Clause

Replace N queries with 1-2 batch queries using SQL `IN` operator.

### Implementation

#### Step 1: Create Batch Chapter Query (15 minutes)

Update `src/lib/content/queries/chapterQueries.ts`:

```typescript
/**
 * Fetches chapters for multiple series in a single query
 *
 * @param seriesIds - Array of series IDs
 * @returns Map of series ID to chapters array
 */
export async function getChaptersBatch(
  seriesIds: string[]
): Promise<Map<string, Chapter[]>> {
  const supabase = await createClient()

  // Single query with IN clause
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .in('series_slug', seriesIds)
    .order('chapter_number', { ascending: true })

  if (error) {
    if (error.code === 'PGRST116') return new Map()
    logger.error({ error, seriesIds }, 'Error fetching chapters batch')
    throw new DatabaseError('Failed to fetch chapters', error)
  }

  // Group chapters by series
  const chapterMap = new Map<string, Chapter[]>()

  for (const chapter of data) {
    const existing = chapterMap.get(chapter.series_slug) ?? []
    existing.push(chapter)
    chapterMap.set(chapter.series_slug, existing)
  }

  return chapterMap
}
```

#### Step 2: Create Batch Vocabulary Stats Query (20 minutes)

Create `src/lib/content/queries/vocabularyStatsQueries.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import pino from 'pino'

const logger = pino()

export interface VocabularyStats {
  chapterSlug: string
  seriesSlug: string
  vocabularyCount: number
}

/**
 * Fetches vocabulary counts for multiple chapters in a single query
 *
 * @param chapterSlugs - Array of chapter slugs
 * @returns Map of chapter slug to vocabulary count
 */
export async function getVocabularyCountsBatch(
  chapterSlugs: string[]
): Promise<Map<string, number>> {
  const supabase = await createClient()

  // Single query with GROUP BY
  const { data, error } = await supabase.rpc('get_vocabulary_counts_batch', {
    chapter_slugs: chapterSlugs,
  })

  if (error) {
    logger.error({ error, chapterSlugs }, 'Error fetching vocab counts batch')
    throw new DatabaseError('Failed to fetch vocabulary counts', error)
  }

  // Convert to Map for O(1) lookups
  const countsMap = new Map<string, number>()
  for (const row of data) {
    countsMap.set(row.chapter_slug, row.vocabulary_count)
  }

  return countsMap
}
```

#### Step 3: Create Database RPC Function (10 minutes)

Create a SQL migration:

```sql
-- supabase/migrations/XXXXXX_get_vocabulary_counts_batch.sql

CREATE OR REPLACE FUNCTION get_vocabulary_counts_batch(
  chapter_slugs text[]
)
RETURNS TABLE (
  chapter_slug text,
  vocabulary_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cv.chapter_slug,
    COUNT(cv.vocabulary_id)::bigint as vocabulary_count
  FROM chapter_vocabulary cv
  WHERE cv.chapter_slug = ANY(chapter_slugs)
  GROUP BY cv.chapter_slug;
END;
$$ LANGUAGE plpgsql;
```

**Why RPC?**
- Single database round-trip
- Efficient GROUP BY in database
- Returns exactly the data needed

#### Step 4: Update Service to Use Batch Queries (30 minutes)

Update `src/lib/content/services/seriesService.ts`:

```typescript
/**
 * Fetches vocabulary statistics for multiple series efficiently
 *
 * @param seriesIds - Array of series IDs
 * @returns Map of series ID to vocabulary stats
 */
export async function getSeriesVocabularyStatsBatch(
  seriesIds: string[]
): Promise<Map<string, VocabularyStats>> {
  // 1. Fetch ALL chapters for ALL series in ONE query
  const chaptersMap = await getChaptersBatch(seriesIds)

  // 2. Collect all chapter slugs
  const allChapterSlugs: string[] = []
  for (const chapters of chaptersMap.values()) {
    allChapterSlugs.push(...chapters.map(c => c.slug))
  }

  // 3. Fetch ALL vocabulary counts in ONE query
  const vocabCountsMap = await getVocabularyCountsBatch(allChapterSlugs)

  // 4. Aggregate by series (in-memory, fast)
  const statsMap = new Map<string, VocabularyStats>()

  for (const [seriesId, chapters] of chaptersMap.entries()) {
    let totalWords = 0

    for (const chapter of chapters) {
      totalWords += vocabCountsMap.get(chapter.slug) ?? 0
    }

    statsMap.set(seriesId, {
      totalWords,
      totalChapters: chapters.length,
    })
  }

  // 5. Fill in series with no chapters
  for (const seriesId of seriesIds) {
    if (!statsMap.has(seriesId)) {
      statsMap.set(seriesId, { totalWords: 0, totalChapters: 0 })
    }
  }

  logger.info(
    {
      seriesCount: seriesIds.length,
      chapterCount: allChapterSlugs.length,
      queriesExecuted: 2, // Only 2 queries!
    },
    'Fetched series vocabulary stats batch'
  )

  return statsMap
}
```

### Before vs After

**Before:**
```typescript
// 300+ queries for 100 series
for (const seriesId of seriesIds) {           // ❌ Loop
  const chapters = await getChaptersBySeriesId(seriesId)  // ❌ Query 1
  for (const chapter of chapters) {           // ❌ Nested loop
    const count = await getVocabCount(chapter.slug)  // ❌ Query 2
  }
}
```

**After:**
```typescript
// 2 queries for 100 series
const chapters = await getChaptersBatch(seriesIds)  // ✅ Query 1
const counts = await getVocabCountsBatch(slugs)     // ✅ Query 2

// In-memory aggregation (fast)
for (const [seriesId, chapterList] of chapters) {
  // O(1) Map lookups, no queries
}
```

---

## Performance Benchmarks

### Test Setup

```typescript
// Benchmark with 100 series
const seriesIds = Array.from({ length: 100 }, (_, i) => `series-${i}`)

// Old implementation
console.time('N+1 Query')
await getSeriesVocabularyStatsBatch_OLD(seriesIds)
console.timeEnd('N+1 Query')

// New implementation
console.time('Batch Query')
await getSeriesVocabularyStatsBatch_NEW(seriesIds)
console.timeEnd('Batch Query')
```

### Expected Results

| Metric              | N+1 Query   | Batch Query | Improvement |
|---------------------|-------------|-------------|-------------|
| Total Queries       | 300+        | 2           | 150x fewer  |
| Database Latency    | 15,000ms    | 100ms       | 150x faster |
| CPU Time            | High        | Low         | 95% less    |
| Connection Pool     | 300 used    | 2 used      | 99% less    |

---

## Finding Other N+1 Queries

### Automated Detection

Create `scripts/detect-n-plus-one.ts`:

```typescript
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

/**
 * Scans codebase for potential N+1 query patterns
 */
function detectNPlusOne(directory: string) {
  const issues: string[] = []

  const files = readdirSync(directory, { recursive: true })

  for (const file of files) {
    if (!file.endsWith('.ts')) continue

    const content = readFileSync(join(directory, file), 'utf-8')
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Pattern: for loop with await inside
      if (line.includes('for (') || line.includes('for(')) {
        // Check next 10 lines for await
        const block = lines.slice(i, i + 10).join('\n')
        if (block.includes('await') && block.includes('from(')) {
          issues.push(`${file}:${i + 1} - Potential N+1 query in loop`)
        }
      }
    }
  }

  return issues
}

const issues = detectNPlusOne('src/lib')
console.log(`Found ${issues.length} potential N+1 queries:`)
issues.forEach(issue => console.log(`  - ${issue}`))
```

### Manual Code Review Checklist

Look for these patterns:

```typescript
// ❌ BAD: Loop with database query
for (const item of items) {
  const data = await supabase.from('table').select()...
}

// ❌ BAD: map() with await
await Promise.all(
  items.map(async item => {
    return await supabase.from('table')...
  })
)

// ✅ GOOD: Batch query with IN clause
const ids = items.map(i => i.id)
const { data } = await supabase.from('table').select().in('id', ids)

// ✅ GOOD: Single query with JOIN
const { data } = await supabase
  .from('parent')
  .select('*, children(*)')
  .in('id', parentIds)
```

---

## Testing

### Performance Test

Create `src/lib/content/services/__tests__/seriesService.perf.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test'
import { getSeriesVocabularyStatsBatch } from '../seriesService'

describe('Series Service Performance', () => {
  it('should fetch stats for 100 series in < 500ms', async () => {
    const seriesIds = Array.from({ length: 100 }, (_, i) => `series-${i}`)

    const startTime = Date.now()
    const stats = await getSeriesVocabularyStatsBatch(seriesIds)
    const duration = Date.now() - startTime

    expect(duration).toBeLessThan(500) // Must be under 500ms
    expect(stats.size).toBe(100)
  })

  it('should make only 2 database queries', async () => {
    const seriesIds = ['series-1', 'series-2', 'series-3']

    // Mock to count queries
    let queryCount = 0
    const originalQuery = supabase.from
    supabase.from = (...args) => {
      queryCount++
      return originalQuery(...args)
    }

    await getSeriesVocabularyStatsBatch(seriesIds)

    expect(queryCount).toBe(2) // Only 2 queries
  })
})
```

### Load Test

```bash
# Install k6 load testing tool
brew install k6

# Create load test
cat > load-test.js <<EOF
import http from 'k6/http'
import { check } from 'k6'

export const options = {
  vus: 100,          // 100 virtual users
  duration: '30s',   // Run for 30 seconds
}

export default function () {
  const res = http.get('http://localhost:3000/api/series?limit=100')

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  })
}
EOF

# Run load test
k6 run load-test.js
```

---

## Other Performance Optimizations

### 1. Add Database Indexes

```sql
-- Index for faster chapter lookups by series
CREATE INDEX IF NOT EXISTS idx_chapters_series_slug
ON chapters(series_slug);

-- Index for faster vocab counts by chapter
CREATE INDEX IF NOT EXISTS idx_chapter_vocabulary_chapter_slug
ON chapter_vocabulary(chapter_slug);

-- Composite index for vocabulary stats
CREATE INDEX IF NOT EXISTS idx_chapter_vocab_stats
ON chapter_vocabulary(chapter_slug, vocabulary_id);
```

### 2. Use Database Views

```sql
-- Create materialized view for frequently accessed stats
CREATE MATERIALIZED VIEW series_vocabulary_stats AS
SELECT
  s.slug as series_slug,
  COUNT(DISTINCT cv.vocabulary_id) as total_words,
  COUNT(DISTINCT c.slug) as total_chapters
FROM series s
LEFT JOIN chapters c ON c.series_slug = s.slug
LEFT JOIN chapter_vocabulary cv ON cv.chapter_slug = c.slug
GROUP BY s.slug;

-- Refresh periodically (e.g., every hour via cron)
REFRESH MATERIALIZED VIEW series_vocabulary_stats;
```

### 3. Cache Results

```typescript
import { getRedisClient } from '@/lib/redis/client'

export async function getSeriesVocabularyStatsBatch(
  seriesIds: string[]
): Promise<Map<string, VocabularyStats>> {
  const redis = await getRedisClient()
  const cacheKey = `series:stats:${seriesIds.join(',')}`

  // Try cache first
  const cached = await redis.get(cacheKey)
  if (cached) {
    return new Map(JSON.parse(cached))
  }

  // Fetch from database
  const stats = await fetchFromDatabase(seriesIds)

  // Cache for 1 hour
  await redis.setex(cacheKey, 3600, JSON.stringify([...stats]))

  return stats
}
```

---

## Success Criteria

✅ Maximum 2 queries for any batch operation
✅ Response time < 500ms for 100 series
✅ No loops with await/database queries inside
✅ Performance tests passing in CI
✅ Database indexes added for frequently queried columns
✅ Load test handles 100 concurrent users

---

## References

- [N+1 Query Problem Explained](https://stackoverflow.com/questions/97197/what-is-the-n1-selects-problem)
- [Supabase Batch Queries](https://supabase.com/docs/guides/database/joins-and-nesting)
- [PostgreSQL IN Clause Performance](https://www.postgresql.org/docs/current/queries-table-expressions.html)
- [Database Query Optimization Guide](https://use-the-index-luke.com/)
