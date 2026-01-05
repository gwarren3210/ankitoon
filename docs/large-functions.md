# Large Functions Documentation

This document lists all functions in the codebase that exceed 100 lines. Functions over 100 lines may benefit from refactoring to improve maintainability and readability.

## Functions > 100 Lines

### 1. `handleStartSession`
- **File:** `src/app/api/study/session/startSession.ts`
- **Lines:** 18-264 (246 lines)
- **Type:** Async function
- **Purpose:** Handles starting a new study session. Validates chapter, gets/creates deck, initializes cards if needed, fetches study cards, and creates session in cache.
- **Input:** supabase client, user id, chapter id
- **Output:** NextResponse with session data
- **Notes:** Complex orchestration function handling multiple steps: validation, deck management, card initialization, session caching.

### 2. `handleEndSession`
- **File:** `src/app/api/study/session/endSession.ts`
- **Lines:** 18-274 (256 lines)
- **Type:** Async function
- **Purpose:** Handles ending a study session. Collects review logs, persists to database, calculates stats, updates progress, and cleans up session cache.
- **Input:** supabase client, user id, session id
- **Output:** NextResponse with session end result
- **Notes:** Complex function handling session cleanup, data persistence, progress updates, and error handling.

### 3. `getChapterVocabulary`
- **File:** `src/lib/series/chapterVocabulary.ts`
- **Lines:** 24-144 (120 lines)
- **Type:** Async function
- **Purpose:** Gets vocabulary for a chapter with full vocabulary details and card states. Optionally fetches user-specific card states if userId is provided.
- **Input:** supabase client, chapter id, optional user id
- **Output:** Array of chapter vocabulary with full details and card states
- **Notes:** Handles both anonymous and authenticated user cases, with complex card state mapping logic.

### 4. `StudySession` Component
- **File:** `src/components/study/studySession.tsx`
- **Lines:** 43-390 (347 lines)
- **Type:** React component
- **Purpose:** Main study session component orchestrating the flashcard study flow. Handles session start, card rating, progress tracking, keyboard shortcuts, and session completion.
- **Input:** series slug, series name, chapter data
- **Output:** Complete study session UI with progress tracking
- **Notes:** Large React component with multiple state variables, effects, and event handlers. Handles complex state management for study flow.

### 5. `VocabularyList` Component
- **File:** `src/components/chapter/vocabularyList.tsx`
- **Lines:** 52-523 (471 lines)
- **Type:** React component
- **Purpose:** Displays enhanced vocabulary list with filtering, sorting, pagination, and statistics. Includes column visibility controls and search functionality.
- **Input:** vocabulary array
- **Output:** Enhanced vocabulary list component with full UI
- **Notes:** Very large component with extensive UI rendering, filtering logic, sorting, pagination, and column management. Largest function in codebase.

## Summary

- **Total functions > 100 lines:** 5
- **Largest function:** `VocabularyList` (471 lines)
- **Average size:** ~288 lines
- **Files affected:** 5 files
- **Categories:**
  - API handlers: 2
  - Library functions: 1
  - React components: 2

## Recommendations

1. **VocabularyList Component (471 lines):** Consider splitting into smaller sub-components:
   - Filter panel component
   - Table component
   - Pagination component
   - Column visibility controls component

2. **StudySession Component (347 lines):** Consider extracting:
   - Session start logic into custom hook
   - Rating submission logic into custom hook
   - Keyboard shortcuts into custom hook
   - Completion screen into separate component

3. **handleStartSession (246 lines):** Consider breaking into smaller helper functions:
   - Chapter validation
   - Deck initialization
   - Card initialization check
   - Session creation

4. **handleEndSession (256 lines):** Consider extracting:
   - Log collection logic
   - Stats calculation
   - Progress update logic
   - Session cleanup

5. **getChapterVocabulary (120 lines):** Consider splitting:
   - Base vocabulary fetching
   - Card state fetching (if user provided)
   - State mapping logic

