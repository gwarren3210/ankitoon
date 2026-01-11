# Data Module Architecture

**Last Updated:** January 2026
**Status:** Implemented

---

## Overview

AnkiToon uses a **3-layer architecture** to separate data access, business logic, and HTTP concerns. This provides clear boundaries, improved testability, and makes the codebase easier to maintain and extend.

## Architecture Layers

```
┌─────────────────────────────────────────┐
│  Routes & Pages (HTTP Layer)            │
│  • Authentication                        │
│  • Request validation                    │
│  • Response formatting                   │
│  • Calls services only                   │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  Services (Business Logic Layer)         │
│  • Orchestrates multiple queries         │
│  • Data transformation                   │
│  • Business rules                        │
│  • Logging (timing, errors)              │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│  Queries (Data Access Layer)            │
│  • Single table per query module         │
│  • Raw database operations               │
│  • No business logic                     │
│  • No logging                            │
└─────────────────────────────────────────┘
```

---

## Directory Structure

```
src/lib/
├── content/                    # Content Domain (public data)
│   ├── queries/
│   │   ├── seriesQueries.ts   # series table
│   │   ├── chapterQueries.ts  # chapters table
│   │   └── vocabularyQueries.ts # vocabulary + chapter_vocabulary
│   └── services/
│       ├── seriesService.ts   # Series catalog orchestration
│       └── chapterService.ts  # Chapter detail orchestration
│
├── progress/                   # User Progress Domain
│   ├── queries/
│   │   ├── chapterProgressQueries.ts
│   │   ├── seriesProgressQueries.ts
│   │   └── sessionQueries.ts
│   └── services/
│       └── activityService.ts # Activity analytics
│
├── user/                       # User Domain
│   ├── queries/
│   │   └── profileQueries.ts  # profiles table
│   └── services/
│       └── profileService.ts  # Profile with stats
│
└── library/                    # Library Domain (cross-domain)
    └── services/
        └── libraryService.ts  # User's library (RPC)
```

---

## Module Responsibility Matrix

| Domain | Tables Owned | Query Layer | Service Layer |
|--------|-------------|-------------|---------------|
| **content** | series, chapters, vocabulary, chapter_vocabulary | Fetch by ID/slug, batch operations | Enrich with stats, adjacent chapters, combine data |
| **progress** | user_chapter_progress_summary, user_series_progress_summary, user_chapter_study_sessions | Fetch progress by user, date ranges | Aggregate stats, calculate trends, weekly activity |
| **user** | profiles | Fetch profile by ID/email | Profile with cross-domain stats |
| **library** | (orchestration only, uses RPC) | N/A | Combine decks + progress + content via RPC |

---

## Design Principles

### Query Layer Rules

1. **Single Table Focus**: Each query module touches exactly one table
2. **No Business Logic**: Pure database operations only
3. **No Logging**: Queries don't log (logging belongs in services)
4. **Consistent Error Handling**:
   - `PGRST116` (no rows) → return `null` or empty array
   - All other errors → throw
5. **Batch Operations Return Maps**: For O(1) lookups

**Example Query:**
```typescript
// content/queries/seriesQueries.ts

export async function getSeriesBySlug(
  supabase: DbClient,
  slug: string
): Promise<Tables<'series'> | null> {
  const { data, error } = await supabase
    .from('series')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}
```

### Service Layer Rules

1. **Orchestration**: Combine multiple queries from any domain
2. **Business Logic**: Stats calculation, data enrichment, transformations
3. **Logging**: Add timing, errors, success logs
4. **Main Function at Top**: Follow existing pattern (main → helpers)
5. **JSDoc Comments**: Document inputs/outputs

**Example Service:**
```typescript
// content/services/seriesService.ts

import { logger } from '@/lib/logger'
import { getSeriesBySlug } from '@/lib/content/queries/seriesQueries'
import { getChaptersBySeriesId } from '@/lib/content/queries/chapterQueries'

export async function getSeriesWithChapterCount(
  supabase: DbClient,
  slug: string
): Promise<(Tables<'series'> & { num_chapters: number }) | null> {
  const series = await getSeriesBySlug(supabase, slug)

  if (!series) {
    return null
  }

  const chapters = await getChaptersBySeriesId(supabase, series.id)

  return {
    ...series,
    num_chapters: chapters.length
  }
}
```

### Route Layer Rules

1. **Call Services Only**: Never call queries directly
2. **Authentication First**: Check user before data operations
3. **Request Validation**: Parse and validate inputs
4. **Error Handling**: Consistent response format
5. **No Business Logic**: Delegate to services

---

## Naming Conventions

| Layer | Pattern | Example |
|-------|---------|---------|
| **Query files** | `{table}Queries.ts` | `seriesQueries.ts`, `chapterProgressQueries.ts` |
| **Service files** | `{domain}Service.ts` | `chapterService.ts`, `activityService.ts` |
| **Query functions** | `get{Entity}By{Criteria}` | `getSeriesBySlug`, `getChaptersBySeriesId` |
| **Batch queries** | `get{Entities}Batch` | `getSeriesProgressBatch` |
| **Service functions** | `{verb}{EntityOrAction}` | `getSeriesWithChapterCount`, `getSeriesVocabularyStats` |

---

## Decision Tree for Developers

**"Where does my new code go?"**

### 1. Is this a database query?
- **YES** → Go to step 2
- **NO** → Go to step 5

### 2. Which table am I querying?
- `series`, `chapters`, `vocabulary` → `content/queries/`
- `user_chapter_progress_summary` → `progress/queries/chapterProgressQueries.ts`
- `user_series_progress_summary` → `progress/queries/seriesProgressQueries.ts`
- `user_chapter_study_sessions` → `progress/queries/sessionQueries.ts`
- `profiles` → `user/queries/profileQueries.ts`

### 3. Am I combining multiple tables?
- **YES** → This is orchestration, go to step 5
- **NO** → Add function to appropriate query file

### 4. Single record or batch?
- **Single** → Name: `get{Entity}By{Criteria}`
- **Batch** → Name: `get{Entities}Batch`, return `Map<>`

### 5. Is this orchestration (combining queries)?
- **YES** → Go to step 6
- **NO** → This might be an API route

### 6. Which domain is the primary focus?
- Series/chapter catalog → `content/services/`
- User progress/activity → `progress/services/`
- User profile → `user/services/`
- Cross-domain (library, dashboard) → `library/services/` or create new domain

---

## Common Patterns

### Pattern 1: Batch Operations

```typescript
// Query layer returns Map for O(1) lookups
export async function getChapterCountsBatch(
  supabase: DbClient,
  seriesIds: string[]
): Promise<Map<string, number>> {
  if (seriesIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('chapters')
    .select('series_id')
    .in('series_id', seriesIds)

  if (error) throw error

  const countMap = new Map<string, number>()
  for (const seriesId of seriesIds) {
    countMap.set(seriesId, 0)
  }
  for (const row of data || []) {
    const current = countMap.get(row.series_id) || 0
    countMap.set(row.series_id, current + 1)
  }
  return countMap
}
```

### Pattern 2: Parallel Query Execution

```typescript
// Service layer orchestrates parallel queries
export async function getChapterPageData(
  supabase: DbClient,
  chapterId: string,
  userId?: string
) {
  const [chapter, vocabulary, progress] = await Promise.all([
    getChapterById(supabase, chapterId),
    getChapterVocabulary(supabase, chapterId),
    userId ? getChapterProgress(supabase, userId, chapterId) : null
  ])

  // Transform and combine results
  return { chapter, vocabulary, progress }
}
```

### Pattern 3: RPC Functions

RPC functions that span multiple tables belong in **services**, not queries.

```typescript
// library/services/libraryService.ts

export async function getUserLibraryDecks(
  supabase: DbClient,
  userId: string
): Promise<LibraryDeck[]> {
  const { data, error } = await supabase.rpc('get_user_library_decks', {
    p_user_id: userId
  })

  if (error) throw error

  return data.map(row => transformRpcResult(row, userId))
}
```

---

## Migration from Old Structure

### Before (Old Structure)
```
src/lib/series/
├── seriesData.ts       # Mixed: queries + orchestration
├── chapterData.ts      # Mixed: queries + orchestration
├── libraryData.ts      # RPC transformation
└── progressData.ts     # Queries only
```

### After (New Structure)
```
src/lib/
├── content/
│   ├── queries/        # Pure queries
│   │   ├── seriesQueries.ts
│   │   ├── chapterQueries.ts
│   │   └── vocabularyQueries.ts
│   └── services/       # Orchestration + logic
│       ├── seriesService.ts
│       └── chapterService.ts
├── progress/
│   ├── queries/
│   │   ├── chapterProgressQueries.ts
│   │   ├── seriesProgressQueries.ts
│   │   └── sessionQueries.ts
│   └── services/
│       └── activityService.ts
└── library/
    └── services/
        └── libraryService.ts
```

---

## Benefits of This Architecture

1. **Clear Boundaries**: Every module has a single, well-defined responsibility
2. **Testability**: Query layer easily mocked, services tested independently
3. **Maintainability**: Easy to find and modify code
4. **Reusability**: Queries can be composed in multiple services
5. **Type Safety**: Proper TypeScript types throughout
6. **Performance**: Batch operations encouraged, parallel queries explicit
7. **No Duplicates**: Logic consolidated in single locations

---

## Quick Reference

| I want to... | File to edit | Pattern to follow |
|--------------|-------------|-------------------|
| Fetch series by slug | `content/queries/seriesQueries.ts` | `getSeriesBySlug()` |
| Get chapters for series | `content/queries/chapterQueries.ts` | `getChaptersBySeriesId()` |
| Get chapter with vocab & progress | `content/services/chapterService.ts` | Orchestrate queries, parallel fetch |
| Get user's recent sessions | `progress/queries/sessionQueries.ts` | `getRecentSessions()` |
| Calculate weekly activity | `progress/services/activityService.ts` | Query + transform |
| Get user library | `library/services/libraryService.ts` | RPC + transformation |
| Add new API endpoint | `app/api/*/route.ts` | Call service, never query |

---

## Related Documentation

- `CLAUDE.md` - Overall architecture and conventions
- `docs/implementation-patterns.md` - Next.js + Supabase patterns
- `docs/logging-guidelines.md` - Strategic logging practices
- `.cursorrules` - Project coding rules
