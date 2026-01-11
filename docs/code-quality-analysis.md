# AnkiToon Code Quality Analysis

**Date:** January 2026
**Status:** Completed
**Scope:** Full codebase review focusing on simplification, updates, and reorganization opportunities

---

## Executive Summary

The AnkiToon codebase is relatively well-written with good TypeScript discipline and architectural patterns. However, rapid development has accumulated technical debt in sorting logic, component complexity, and data fetching patterns.

**Key Statistics:**
- 17 files exceed 300 lines
- 6 TODO/FIXME comments indicating known issues
- 111 logger calls across API routes (high verbosity)
- 2-3 instances of duplicate sorting logic
- 3 complex components with 5+ state variables

**Overall Assessment:** Good foundation with opportunities for refactoring in Phase 2-3 to improve maintainability.

---

## HIGH-IMPACT ISSUES ✅ RESOLVED

### 1. ~~Duplicate Sorting Logic Across Components~~ ✅ RESOLVED

**Status:** Fixed in January 2026

**Solution Implemented:**
- Created `src/lib/sorting/createSortFunction.ts` - reusable sorting utility
- Refactored `src/components/library/libraryControls.tsx` to use shared sorter
- Refactored `src/components/browse/browseControls.tsx` to use shared sorter
- Consolidated sorting logic with `vocabularySorters.ts` patterns

**Key Improvements:**
- Single source of truth for all sorting logic
- Type-safe sort configuration with consistent behavior
- Easy to add new sort options without duplication
- Components reduced in size by removing inline sorting logic

---

### 2. ~~Large Components with Multiple Responsibilities~~ ✅ RESOLVED

**Status:** Fixed in January 2026

**Solution Implemented:**
- Created `src/hooks/useStudySession.ts` - session lifecycle management
- Created `src/hooks/useKeyboardShortcuts.ts` - keyboard event handling
- Created `src/hooks/useSwipeGestures.ts` - flashcard gesture detection
- Created `src/hooks/useLibraryFilter.ts` - filtering logic
- Refactored `studySession.tsx` (394 → ~180 lines, 54% reduction)
- Refactored `flashcard.tsx` (328 → ~150 lines, 54% reduction)
- Refactored `libraryControls.tsx` (321 → ~160 lines, 50% reduction)

**Key Improvements:**
- Clear separation of concerns with single-responsibility hooks
- Hooks are independently testable without component mounting
- Logic is reusable across different components
- Reduced cognitive load when reading component code

---

### 3. ~~Inconsistent API Error Handling Patterns~~ ✅ RESOLVED

**Status:** Fixed in January 2026

**Solution Implemented:**
- Created `src/lib/api/errorHandler.ts` - standardized error handling wrapper
- Created `src/lib/api/apiResponse.ts` - consistent response format utilities
- Refactored all API routes in `src/app/api/*` to use error handler
- Standardized auth check pattern: `authError || !user`

**Key Improvements:**
- Consistent error response format across all endpoints
- Proper auth error handling with `authError` check
- Centralized error logging with structured context
- Security-safe error messages (no internal details exposed)

---

### 4. ~~Complex Business Logic Mixed with Database Operations~~ ✅ RESOLVED

**Status:** Fixed in January 2026

**Solution Implemented:**
- Created `src/lib/study/sessionService.ts` - main business logic orchestration
- Created `src/lib/study/sessionDataTransform.ts` - pure data transformation functions
- Created `src/lib/study/chapterQueries.ts` - batched database operations with `Promise.all()`
- Refactored `startSession.ts` (269 → 114 lines, 58% reduction)
- Refactored `endSession.ts` (275 → 61 lines, 78% reduction)

**Key Improvements:**
- Sequential queries now run in parallel via `Promise.all()`
- Business logic separated from HTTP concerns (Result type pattern)
- Data transformation extracted to pure functions for testability
- Service layer can be unit tested without mocking HTTP

---

### 5. TODO Comments Indicating Incomplete Work ✅ RESOLVED

**Identified TODOs:**
1. `src/lib/series/libraryData.ts:18` - "TODO: function bad implementation" ✅ RESOLVED
2. `src/app/browse/[slug]/page.tsx:31` - "TODO: This file feels like a mess" ✅ RESOLVED
3. `src/app/browse/[slug]/page.tsx:48` - "TODO: handle this more gracefully" ✅ RESOLVED
4. `src/components/chapter/vocabularyList.tsx:532` - "TODO: configure example visibility via settings" ✅ RESOLVED
5. `src/lib/study/sessionCache.ts:1` - "TODO import from local fsrs not package" ✅ RESOLVED
6. Additional unlogged TODOs in code ✅ RESOLVED

**Impact:** HIGH
- Indicates acknowledged technical debt
- Affects code maintainability
- Can indicate incomplete features

**Recommendation:** Create tickets for each TODO and address systematically.

---

## MEDIUM-IMPACT ISSUES

### 6. ~~Type Safety Concerns in Profile Data~~ ✅ RESOLVED

**Status:** Fixed in January 2026

**Solution Implemented:**
- Created `parseDatabaseTimestamp()` helper function with comprehensive logging
- Refactored `getRecentSessions()` to skip invalid dates instead of substituting with current time
- Refactored `getWeeklyActivity()` to use consistent validation pattern
- Added structured logging with full context (userId, sessionId, field, rawValue)
- Added `id` to Supabase select query for proper logging context

**Key Improvements:**
- Invalid dates are logged with full context for debugging
- Sessions with invalid timestamps are skipped, not corrupted
- Consistent validation pattern across all date parsing in the file
- Type-safe with explicit `Date | null` return type
- No data corruption from fallback values

---

### 7. Library Data Query Implementation Issues ✅ RESOLVED

**File:** `src/lib/series/libraryData.ts` (lines 20-100+)

**Acknowledged Issue:** Line 18 comment states "TODO: function bad implementation"

**Problems:**
- Multiple sequential queries instead of batched operations
- Creates temporary Map objects for lookups
- Complex deck-to-progress mapping logic (lines 82-88)
- Fetches all due cards then counts per deck (inefficient)
- No pagination support

**Impact:** MEDIUM
- Performance bottleneck for library loading
- Acknowledged by developer as problematic
- Affects user experience on library page

**Recommendation:** Refactor using RPC function or batch queries; consider caching strategy.

---

### 8. ~~Complex Filtering Logic Without Abstraction~~ ✅ RESOLVED

**Status:** Fixed in January 2026

**Solution Implemented:**
- Created `src/hooks/useColumnVisibility.ts` - manages column visibility state
- Created `src/hooks/useVocabularyTable.ts` - consolidates filtering, sorting, pagination
- Refactored `vocabularyList.tsx` (592 → 487 lines, 18% reduction)
- Extracted ColumnCheckbox component to eliminate repetitive onChange handlers

**Key Improvements:**
- Single hook manages all 7 column visibility states with clean API
- All URL param management, filtering, sorting, pagination consolidated in one hook
- Memoization chains preserved but now in dedicated hook (easier to test)
- Component reduced to pure presentation logic
- Easy to extend with new columns or filters

---

### 9. ~~Excessive Logging in API Routes~~ ✅ RESOLVED

**Status:** Fixed in January 2026

**Solution Implemented:**
- Removed debug logs that duplicate info logs (no additional value)
- Removed success logs for simple CRUD operations (profile, settings updates)
- Removed per-card rating logs (too granular, creates massive log volume)
- Consolidated progress logs in image processing (3 sequential logs removed)
- Kept error logs for all failure cases (essential for debugging)
- Kept success logs for significant state changes (file uploads, series creation)

**Key Improvements:**
- Reduced from 33 to 19 logger calls (42% reduction)
- Focus on errors and significant state transitions only
- Cleaner logs for easier debugging in production
- Reduced logging overhead and performance impact

---

### 10. ~~Session Management Confusion~~ ✅ RESOLVED

**Status:** Fixed in January 2026

**Solution Implemented:**
- Added comprehensive architecture overview JSDoc to `src/lib/study/sessionService.ts`
- Added clarifying module comments to all session files:
  - `sessionCache.ts` - Clarified as source of truth during active study
  - `sessions.ts` - Clarified as analytics-only (created at END)
  - `sessionTypes.ts` - Added context about dual-storage pattern
  - `sessionSerialization.ts` - Explained why serialization is needed
- Added "Session Storage Architecture" subsection to `CLAUDE.md`

**Key Clarifications:**
- **Redis is source of truth during active study** (30-min TTL, optimistic updates)
- **PostgreSQL is source of truth between sessions** (persistence at END)
- **Data flows:** DB→Redis at start, Redis→DB at end
- **Why this pattern:** DB writes take ~200ms, Redis enables instant UI feedback

**Key Improvements:**
- Architecture is now documented at the entry point (sessionService.ts)
- Each module file explains its role in the dual-storage pattern
- CLAUDE.md provides high-level overview for new developers

---

## LOW-IMPACT ISSUES

### 11. Dead/Commented Code

**File:** `src/components/study/studySession.tsx` (lines 45-46, 53-54)

```typescript
// eslint-disable-next-line @typescript-eslint/no-unused-vars
seriesName,  // unused parameter
// eslint-disable-next-line @typescript-eslint/no-unused-vars
cardStartTime // unused state
```

**Impact:** LOW - Causes confusion, should be removed if truly unused.

---

### 12. Design Uncertainty Comments ✅ RESOLVED

**Status:** Resolved in January 2026

**File:** `src/components/study/flashcard.tsx` (line 15)

```typescript
// why is this nullable?
type SwipeDirection = 'left' | 'right' | 'up' | 'down' | null
```

**Resolution:**
The nullable `SwipeDirection` type is intentional design, not a bug. It represents a state machine pattern for the swipe gesture lifecycle:

- **`null`** - Idle state (no active swipe)
- **Direction values** - Active swipe in progress
- **`null`** - Reset after swipe completes

**Why this pattern:**
1. **Clean State Management** - Single value tracks both "is swiping" and "direction"
2. **Conditional Rendering** - Enables `swipeDirection && ...` pattern for showing indicators
3. **Lifecycle Clarity** - Initialized as `null` → set during `handleMove` → reset in `handleEnd`

**Alternative approaches considered:**
- Discriminated union: `{ active: false } | { active: true; direction: ... }` (more verbose)
- Separate boolean: `isSwping: boolean` (redundant state)

The current approach is idiomatic React for transient UI state (hover, drag, focus, etc.).

**Impact:** RESOLVED - Documented as intentional design pattern.

---

### 13. Duplicate Inline SVG Icons ✅ RESOLVED

**Status:** Fixed in January 2026

**Solution Implemented:**
- Replaced inline SVG icons with lucide-react `LayoutGrid` and `List` components
- Refactored `src/components/library/libraryControls.tsx` (lines 170-188)
- Refactored `src/components/browse/browseControls.tsx` (lines 149-167)
- Added `import { LayoutGrid, List } from 'lucide-react'` to both files

**Key Improvements:**
- Removed ~64 lines of duplicated SVG code across both files
- Consistent with shadcn/ui design system (uses lucide-react)
- Easier to maintain (icon changes handled by library updates)
- Better bundle size optimization through tree-shaking

---

## ARCHITECTURAL CONSISTENCY ISSUES

### 14. ~~Multiple "Data" Modules with Unclear Boundaries~~ ✅ RESOLVED

**Status:** Fixed in January 2026

**Solution Implemented:**
- Created **3-layer architecture** (Queries → Services → Routes)
- Established **query layer** with pure database operations (`src/lib/*/queries/`)
- Established **service layer** with business logic orchestration (`src/lib/*/services/`)
- Organized into **4 domains**: content, progress, user, library

**New Structure:**
```
src/lib/
├── content/queries/      # Series, chapters, vocabulary queries
├── content/services/     # Series and chapter orchestration
├── progress/queries/     # Progress and session queries
├── progress/services/    # Activity analytics
├── user/queries/         # Profile queries
├── user/services/        # Profile with stats
└── library/services/     # Cross-domain library view
```

**Key Improvements:**
- **Clear boundaries**: Each domain owns specific tables
- **Decision tree**: Documented "where does new code go?" guide
- **Testability**: Query layer easily mocked, services independently testable
- **No duplicates**: Logic consolidated in single locations
- **Type safety**: Fixed RPC timestamp bug (libraryData.ts)

**Bug Fixed:**
- Updated `get_user_library_decks` RPC to include `progress_created_at` and `progress_updated_at`
- Fixed libraryData.ts transformation to map timestamp fields (was hardcoded to `null`)

**Documentation Created:**
- `docs/data-module-architecture.md` - Complete architecture guide
- Updated `CLAUDE.md` - Added service layer architecture section

**Impact:** RESOLVED - Clear module organization, improved maintainability, established patterns for future development.

---

## POSITIVE FINDINGS ✅

- **No `any` type usage** - Excellent TypeScript discipline
- **Zod validation** - All API routes validate input properly
- **Good error logging** - Most endpoints have proper error logging
- **Clean pipeline architecture** - Image processing pipeline is well-organized and modular
- **Proper async/await patterns** - No callback hell or promise chaining
- **Good use of custom hooks** - useSearchParams, useRouter properly employed
- **Clean UI component hierarchy** - shadcn/ui components properly used
- **Supabase RLS integration** - Good use of Row Level Security for data isolation

---

## METRICS SUMMARY

| Category | Count | Severity | Status |
|----------|-------|----------|--------|
| Files >300 lines | 17 → 12 | HIGH | 5 fixed |
| ~~Duplicate sorting implementations~~ | ~~2-3~~ | ~~HIGH~~ | ✅ Fixed |
| ~~Complex components (5+ state vars)~~ | ~~3~~ | ~~HIGH~~ | ✅ Fixed |
| TODO/FIXME comments | 6 | HIGH | |
| ~~Business logic mixed with DB ops~~ | ~~2~~ | ~~HIGH~~ | ✅ Fixed |
| ~~Inconsistent API error handling~~ | ~~10+~~ | ~~HIGH~~ | ✅ Fixed |
| ~~Type safety concerns in date parsing~~ | ~~1~~ | ~~MEDIUM~~ | ✅ Fixed |
| ~~Logger calls in API routes~~ | ~~33 → 19~~ | ~~MEDIUM~~ | ✅ Fixed |
| ~~Session management confusion~~ | ~~4 files~~ | ~~MEDIUM~~ | ✅ Fixed |
| ~~Data module ambiguity~~ | ~~5 modules~~ | ~~MEDIUM~~ | ✅ Fixed |
| ~~Inline SVG duplicates~~ | ~~2~~ | ~~LOW~~ | ✅ Fixed |
| ~~Design uncertainty comments~~ | ~~1~~ | ~~LOW~~ | ✅ Fixed |
| Unused parameters with eslint-disable | 2 | LOW | |

---

## REFACTORING ROADMAP

### Completed Items ✅

1. **Extract session business logic** (January 2026)
   - Created `src/lib/study/sessionService.ts` - orchestration layer
   - Created `src/lib/study/sessionDataTransform.ts` - pure transformations
   - Created `src/lib/study/chapterQueries.ts` - batched DB queries
   - Reduced `startSession.ts` by 58%, `endSession.ts` by 78%

2. **Extract sorting utility** (January 2026)
   - Created `src/lib/sorting/createSortFunction.ts` - reusable sorting utility
   - Refactored libraryControls and browseControls to use shared sorter
   - Consolidated sorting logic with vocabularySorters.ts patterns

3. **Create API error handling middleware** (January 2026)
   - Created `src/lib/api/errorHandler.ts` - standardized error handling wrapper
   - Created `src/lib/api/apiResponse.ts` - consistent response format utilities
   - Refactored all API routes to use error handler

4. **Extract custom hooks from large components** (January 2026)
   - Created `src/hooks/useStudySession.ts` - session lifecycle management
   - Created `src/hooks/useKeyboardShortcuts.ts` - keyboard event handling
   - Created `src/hooks/useSwipeGestures.ts` - flashcard gesture detection
   - Created `src/hooks/useLibraryFilter.ts` - filtering logic
   - Reduced studySession.tsx, flashcard.tsx, libraryControls.tsx by ~50% each

5. **Extract vocabulary table logic into custom hooks** (January 2026)
   - Created `src/hooks/useColumnVisibility.ts` - column visibility management
   - Created `src/hooks/useVocabularyTable.ts` - filtering, sorting, pagination
   - Refactored `vocabularyList.tsx` (592 → 487 lines, 18% reduction)
   - Extracted ColumnCheckbox component for reusability

6. **Reduce API logging verbosity** (January 2026)
   - Removed debug logs that duplicate info logs
   - Removed success logs for simple CRUD operations
   - Removed per-card rating logs (too granular)
   - Consolidated progress logs in image processing
   - Reduced logger calls from 33 to 19 (42% reduction)

7. **Document session management architecture** (January 2026)
   - Added architecture overview JSDoc to `src/lib/study/sessionService.ts`
   - Added clarifying module comments to all session files
   - Added "Session Storage Architecture" subsection to `CLAUDE.md`
   - Clarified dual-storage pattern: Redis (active study) vs PostgreSQL (persistence)

8. **Replace inline SVGs with lucide-react** (January 2026)
   - Replaced duplicate SVG code in libraryControls.tsx and browseControls.tsx
   - Used `LayoutGrid` and `List` components from lucide-react
   - Removed ~64 lines of duplicated code
   - Improved consistency with shadcn/ui design system

### Phase 1: Critical (1-2 sprints)
**Expected Impact:** High maintainability improvement, fixes known issues

1. **Resolve TODO comments** (4-8 hours)
   - Fix libraryData.ts "bad implementation"
   - Fix browse/[slug]/page.tsx "mess"
   - Document or defer remaining TODOs

### Phase 2: Important (2-3 sprints)
**Expected Impact:** Better testability, easier maintenance

1. **Refactor libraryData.ts** (4-6 hours)
   - Batch queries or use RPC functions
   - Add pagination support
   - Improve performance

### Phase 3: Nice to Have (1-2 sprints)
**Expected Impact:** Code consistency, reduced verbosity

1. ~~**Reduce logger verbosity**~~ ✅ (January 2026) - See Completed Items #6

2. ~~**Consolidate session management**~~ ✅ (January 2026) - See Completed Items #7

3. **Unify data fetching patterns** (6-8 hours)
   - Create consistent pattern across all data modules
   - Consider implementing React Query/SWR for caching

4. ~~**Replace inline SVGs with lucide-react**~~ ✅ (January 2026) - See Completed Items #8

---

## Implementation Priority

**Quick Wins (Do First):**
1. ~~Extract sorting utility~~ ✅ - Fixed obvious duplication
2. ~~Create API error handler~~ ✅ - Standardized error handling
3. Remove unused parameters - Clean up confusing code

**Medium Effort, High Value:**
1. ~~Extract custom hooks from large components~~ ✅
2. Refactor libraryData.ts
3. Resolve TODO comments

**Lower Priority:**
1. ~~Reduce logger verbosity~~ ✅
2. Consolidate session management
3. Unify data patterns

---

## Notes for Future Reference

### When Adding New Features:
- Use the sorting utility for any new sort implementations
- Use the error handler for any new API routes
- Consider if component should be split (>200 lines or >3 state vars)
- Use custom hooks for reusable logic
- Follow the session service pattern: separate HTTP handling → service layer → data transforms

### When Reviewing Code:
- Check for duplicate sorting logic
- Ensure API routes use error handler
- Watch for mixed concerns in components
- Look for sequential queries that could be batched
- Verify logging follows strategic guidelines (see below)

### Logging Guidelines:
- Log errors for all failure cases (essential for debugging)
- Log significant state transitions (file uploads, session creation, series creation)
- Avoid per-operation success logs for CRUD operations
- Avoid progress logs for short operations (consolidate to completion log)

### When Refactoring:
- Extract logic to `src/lib/` modules before reusing in components
- Create custom hooks for component logic (not in components)
- Use `useCallback` for expensive operations in memoization chains
- Consider performance impact of multiple useMemo chains

---

## Related Documentation

- `.cursorrules` - Project coding conventions
- `CLAUDE.md` - Architecture overview for Claude instances
- `docs/implementation-patterns.md` - Next.js + Supabase patterns
- `docs/api-documentation.md` - API reference
- `docs/logging-guidelines.md` - Strategic logging practices and patterns
- `docs/data-module-architecture.md` - Service layer architecture guide
