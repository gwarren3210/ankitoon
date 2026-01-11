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

## HIGH-IMPACT ISSUES

### 1. Duplicate Sorting Logic Across Components ⚠️ CRITICAL

**Files Affected:**
- `src/components/library/libraryControls.tsx` (lines 110-170)
- `src/components/browse/browseControls.tsx` (lines 69-112)
- `src/lib/chapter/vocabularySorters.ts` (lines 34-116)

**Issue:** Sorting logic is duplicated across multiple components. LibraryControls and BrowseControls each implement their own sort functions with nearly identical switch statements, while vocabularySorters.ts only handles vocabulary sorting.

**Problem Code Example (LibraryControls, lines 110-170):**
```typescript
const sortedDecks = useMemo(() => {
  const sorted = [...filteredDecks]
  switch (sortOption) {
    case 'last-studied-desc':
      return sorted.sort((a, b) => {
        const aDate = a.progress.last_studied ? new Date(a.progress.last_studied).getTime() : 0
        const bDate = b.progress.last_studied ? new Date(b.progress.last_studied).getTime() : 0
        return bDate - aDate
      })
    // ... 8 more cases with inline sorting logic
  }
}, [filteredDecks, sortOption])
```

**Impact:** HIGH
- Maintenance burden when sorting logic needs updates
- Risk of inconsistency between components
- Code duplication violates DRY principle

**Recommendation:** Extract into a reusable `createSortFunction()` utility that both components use.

---

### 2. Large Components with Multiple Responsibilities

**a) studySession.tsx (394 lines)**
- **Path:** `src/components/study/studySession.tsx`
- **Responsibilities:** Card state management, session lifecycle, keyboard shortcuts, rating logic, UI rendering
- **Concerns Mixing:** 5+ useState calls, multiple useEffect hooks managing interdependent state
- **Problem:** Changes to one concern affect others; difficult to test individual features

**b) flashcard.tsx (328 lines)**
- **Path:** `src/components/study/flashcard.tsx`
- **Responsibilities:** Swipe gesture detection, animation state, flip logic, rendering
- **Issue:** Complex swipe threshold calculations and position tracking mixed with React hooks

**c) libraryControls.tsx (321 lines)**
- **Path:** `src/components/library/libraryControls.tsx`
- **Responsibilities:** Filtering, sorting, search, view mode toggling
- **Issue:** Multiple useMemo chains with interdependent logic

**Impact:** HIGH
- Difficult to test individual features
- Difficult to reason about state changes
- Difficult to reuse logic

**Recommendation:** Extract into smaller components and custom hooks:
- `useStudySession` - session lifecycle management
- `useKeyboardShortcuts` - keyboard event handling
- `useSwipeGestures` - flashcard gesture detection
- `useLibrarySort` - generic sorting utility
- `useLibraryFilter` - filtering logic

---

### 3. Inconsistent API Error Handling Patterns

**Files Affected:** All API routes in `src/app/api/*`

**Issue:** Error handling patterns vary across routes:
- Some routes check `authError || !user` (correct)
- Others only check `!user` (missing authError handling)
- Some expose error details inconsistently
- No standardized response format

**Problem Code (Profile Route):**
```typescript
if (!response.ok) {
  const errorData = await response.json().catch(() => ({}))
  throw new Error(errorData.error || 'Failed to end session')
}
```

**Better Pattern (Study Rate Route):**
```typescript
if (authError || !user) {
  logger.error({ authError }, 'Authentication required')
  return NextResponse.json(
    { error: 'Authentication required' },
    { status: 401 }
  )
}
```

**Impact:** HIGH
- Inconsistent error handling makes debugging difficult
- Creates potential security gaps
- Hard to add features that rely on consistent error handling

**Recommendation:** Create error handling utility wrapper for API routes.

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

### 5. TODO Comments Indicating Incomplete Work

**Identified TODOs:**
1. `src/lib/series/libraryData.ts:18` - "TODO: function bad implementation"
2. `src/app/browse/[slug]/page.tsx:31` - "TODO: This file feels like a mess"
3. `src/app/browse/[slug]/page.tsx:48` - "TODO: handle this more gracefully"
4. `src/components/chapter/vocabularyList.tsx:532` - "TODO: configure example visibility via settings"
5. `src/lib/study/sessionCache.ts:1` - "TODO import from local fsrs not package"
6. Additional unlogged TODOs in code

**Impact:** HIGH
- Indicates acknowledged technical debt
- Affects code maintainability
- Can indicate incomplete features

**Recommendation:** Create tickets for each TODO and address systematically.

---

## MEDIUM-IMPACT ISSUES

### 6. Type Safety Concerns in Profile Data

**File:** `src/lib/profile/activityData.ts` (lines 49-71)

**Issue:** Date parsing without proper validation:
```typescript
const studiedAt = session.studied_at ? new Date(session.studied_at) : new Date()
if (isNaN(studiedAt.getTime())) {
  return { /* ... */ }
}
```

This catches invalid dates but returns the same structure without clear error indication.

**Impact:** MEDIUM - Can silently mask data quality issues.

**Recommendation:** Use more explicit validation or logging when invalid dates are detected.

---

### 7. Library Data Query Implementation Issues

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

### 8. Complex Filtering Logic Without Abstraction

**File:** `src/components/chapter/vocabularyList.tsx` (lines 52-156)

**Issues:**
- Multiple independent useMemo chains (filteredVocabulary, sortedVocabulary)
- Pagination logic mixed with filter/sort logic
- 7+ state variables for column visibility (lines 74-82)
- Complex conditional rendering for table columns (lines 397-459)

**State Variables:**
```typescript
const [showKorean, setShowKorean] = useState(true)
const [showEnglish, setShowEnglish] = useState(true)
const [showExample, setShowExample] = useState(true)
const [showImportance, setShowImportance] = useState(false)
const [showSenseKey, setShowSenseKey] = useState(false)
// ... more states
```

**Impact:** MEDIUM
- Hard to maintain visibility logic
- Performance issues with multiple memoization layers
- Difficult to add new columns

**Recommendation:** Extract column visibility into custom hook or context.

---

### 9. Excessive Logging in API Routes

**Issue:** 111 logger calls across API routes

**Example (endSession.ts):** ~25 logger statements for a single endpoint

**Problems:**
- Logging overhead affects performance
- Verbose log output makes debugging harder
- Many duplicate log objects with userId, sessionId, etc.

**Impact:** MEDIUM
- Performance impact in production
- Log noise makes debugging harder
- Difficult to find relevant logs

**Recommendation:** Implement strategic logging - only log errors, state transitions, and key milestones.

---

### 10. Session Management Confusion

**Files:**
- `src/lib/study/sessions.ts` - creates study sessions in DB
- `src/lib/study/sessionCache.ts` - manages sessions in Redis
- `src/lib/study/sessionSerialization.ts` - handles serialization
- `src/lib/study/sessionTypes.ts` - type definitions

**Issue:** Unclear separation of concerns. Session concept exists in 4+ places.

**Questions:**
- Which is source of truth - DB or Redis?
- When is each used?
- How are they kept in sync?

**Impact:** MEDIUM
- Risk of data consistency issues
- Difficult to understand session flow
- Hard to add session features

**Recommendation:** Document session management architecture; clarify Redis vs DB usage.

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

### 12. Design Uncertainty Comments

**File:** `src/components/study/flashcard.tsx` (line 15)

```typescript
// why is this nullable?
type SwipeDirection = 'left' | 'right' | 'up' | 'down' | null
```

**Impact:** LOW - Indicates uncertainty, should be resolved or documented.

---

### 13. Duplicate Inline SVG Icons

**Files:**
- `src/components/library/libraryControls.tsx` (lines 200-234)
- `src/components/browse/browseControls.tsx` (lines 163-197)

**Issue:** SVGs for grid/list view icons are duplicated inline instead of using lucide-react icons.

**Impact:** LOW - Code duplication, but both lucide-react and inline SVGs are already in use.

**Recommendation:** Use lucide-react consistently.

---

## ARCHITECTURAL CONSISTENCY ISSUES

### 14. Multiple "Data" Modules with Unclear Boundaries

**Files:**
- `src/lib/series/seriesData.ts`
- `src/lib/series/chapterData.ts`
- `src/lib/series/libraryData.ts`
- `src/lib/profile/profileData.ts`
- `src/lib/profile/activityData.ts`

**Issue:** No clear pattern for which "data" module handles what. Similar functionality might be duplicated.

**Questions:**
- What's the difference between seriesData, chapterData, libraryData?
- Why is libraryData acknowledged as "bad implementation"?
- Should these be consolidated?

**Impact:** MEDIUM - Maintainability issue, unclear code organization.

**Recommendation:** Create unified data fetching pattern or document clear boundaries.

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
| Files >300 lines | 17 → 15 | HIGH | 2 fixed |
| Duplicate sorting implementations | 2-3 | HIGH | |
| Complex components (5+ state vars) | 3 | HIGH | |
| TODO/FIXME comments | 6 | HIGH | |
| ~~Business logic mixed with DB ops~~ | ~~2~~ | ~~HIGH~~ | ✅ Fixed |
| Logger calls in API routes | 111 | MEDIUM | |
| Data module ambiguity | 5 modules | MEDIUM | |
| Inline SVG duplicates | 2 | LOW | |
| Unused parameters with eslint-disable | 2 | LOW | |

---

## REFACTORING ROADMAP

### Completed Items ✅

1. **Extract session business logic** (January 2026)
   - Created `src/lib/study/sessionService.ts` - orchestration layer
   - Created `src/lib/study/sessionDataTransform.ts` - pure transformations
   - Created `src/lib/study/chapterQueries.ts` - batched DB queries
   - Reduced `startSession.ts` by 58%, `endSession.ts` by 78%

### Phase 1: Critical (1-2 sprints)
**Expected Impact:** High maintainability improvement, fixes known issues

1. **Extract sorting utility** (2-4 hours)
   - Create `src/lib/sorting/createSortFunction.ts`
   - Use in libraryControls and browseControls
   - Eliminates duplication immediately

2. **Create API error handling middleware** (2-3 hours)
   - Create `src/lib/api/errorHandler.ts`
   - Standardize all 10+ API routes
   - Fixes inconsistent error handling

3. **Resolve TODO comments** (4-8 hours)
   - Fix libraryData.ts "bad implementation"
   - Fix browse/[slug]/page.tsx "mess"
   - Document or defer remaining TODOs

### Phase 2: Important (2-3 sprints)
**Expected Impact:** Better testability, easier maintenance

1. **Extract study session hooks** (6-8 hours)
   - Create `useStudySession` custom hook
   - Create `useKeyboardShortcuts` custom hook
   - Reduces studySession.tsx from 394 → ~150 lines

2. **Extract flashcard gesture logic** (4-6 hours)
   - Create `useSwipeGestures` custom hook
   - Reduces flashcard.tsx from 328 → ~150 lines

3. **Refactor libraryData.ts** (4-6 hours)
   - Batch queries or use RPC functions
   - Add pagination support
   - Improve performance

### Phase 3: Nice to Have (1-2 sprints)
**Expected Impact:** Code consistency, reduced verbosity

1. **Reduce logger verbosity** (2-3 hours)
   - Remove non-essential logging
   - Keep only errors, warnings, and state transitions
   - Reduce 111 calls to ~30-40 strategic calls

2. **Consolidate session management** (4-6 hours)
   - Document Redis vs DB usage
   - Clarify session flow
   - Ensure data consistency

3. **Unify data fetching patterns** (6-8 hours)
   - Create consistent pattern across all data modules
   - Consider implementing React Query/SWR for caching

4. **Replace inline SVGs with lucide-react** (1 hour)
   - Use consistent icon library

---

## Implementation Priority

**Quick Wins (Do First):**
1. Extract sorting utility - Fixes obvious duplication
2. Create API error handler - Standardizes error handling
3. Remove unused parameters - Clean up confusing code

**Medium Effort, High Value:**
1. Extract custom hooks from large components
2. Refactor libraryData.ts
3. Resolve TODO comments

**Lower Priority:**
1. Reduce logger verbosity
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
