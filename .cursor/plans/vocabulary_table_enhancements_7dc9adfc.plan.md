---
name: Vocabulary Table Enhancements
overview: Enhance the vocabulary list component with additional data fields, advanced filtering options, and improved sorting capabilities to support both study planning and vocabulary discovery.
todos:
  - id: research-data
    content: Review data fetching in chapterData.ts to determine what additional fields need to be fetched from database
    status: completed
  - id: update-types
    content: Extend ChapterVocabulary type to include all new fields (reviews, streaks, stability, difficulty, etc.)
    status: completed
  - id: add-display-fields
    content: "Update VocabularyItem component to display new fields: review count, last studied, next due date, stability, difficulty"
    status: completed
  - id: implement-text-search
    content: Add text search filter for term, definition, and example fields
    status: completed
  - id: add-state-filters
    content: Add filtering by card state, study status, and due status
    status: completed
  - id: extend-sorting
    content: "Add sorting options: last studied, next due, review count, correct streak, word length"
    status: completed
  - id: add-statistics
    content: Create statistics summary panel showing breakdown by state, accuracy averages, etc.
    status: completed
  - id: enhance-ui
    content: Add color coding for due dates, progress indicators, expandable rows for details, column visibility controls
    status: completed
---

# Vocabulary Table Enhancement Plan

## Current State

The vocabulary list currently displays:

- Term (Korean word)
- Definition (English)
- Example sentence (optional)
- Card state badge (New/Learning/Review/Relearning)
- Sorting by importance score or term
- Pagination (20 items per page)

Available data not currently displayed:

- `lastStudied` date
- `nextDue` date
- `total_reviews`, `streak_correct`, `streak_incorrect` (from SRS cards)
- `stability`, `difficulty`, `scheduled_days` (FSRS metrics)
- `first_seen_date`
- `importanceScore` value (used for sorting but not displayed)

## Proposed Enhancements

### 1. Additional Data Fields

#### Study Progress Metrics

- **Review count** (`total_reviews`): Number of times reviewed
- **Correct streak** (`streak_correct`): Consecutive correct answers
- **Last studied date**: Formatted relative time (e.g., "2 days ago")
- **Next due date**: Formatted relative time (e.g., "due in 3 days")
- **First seen date**: When the word was first encountered
- **Study accuracy**: Calculated from review history (if available)

#### FSRS Metrics (Advanced)

- **Stability**: Memory strength indicator
- **Difficulty**: How hard the word is for the user
- **Scheduled interval**: Days until next review

#### Vocabulary Metadata

- **Importance score**: Numeric value (currently only used for sorting)
- **Word length**: Character count for Korean term

### 2. Filtering Options

#### Study State Filters

- Filter by card state: New, Learning, Review, Relearning
- Filter by study status: Studied, Not studied, All
- Filter by due status: Due now, Due soon, Not due, All

#### Performance Filters

- Filter by accuracy: High (>80%), Medium (50-80%), Low (<50%), All
- Filter by review count: None, 1-5, 6-20, 20+, All
- Filter by streak: High streak (5+), Low streak (<5), No streak, All

#### Vocabulary Filters

- Filter by importance score: High (top 25%), Medium (25-75%), Low (bottom 25%), All

#### Text Search

- Search by term (Korean)
- Search by definition (English)
- Case-insensitive partial matching

### 3. Enhanced Sorting Options

Current: Importance score, Term (alphabetical)Additional options:

- **Last studied** (most recent first/last)
- **Next due date** (earliest due first)
- **Review count** (most/least reviewed)
- **Correct streak** (highest/lowest)
- **Difficulty** (hardest/easiest)
- **Stability** (most/least stable)
- **Word length** (shortest/longest)
- **First seen** (newest/oldest)

### 4. UI/UX Enhancements

#### Display Modes

- **Table view**: Compact, sortable columns (term, definition, state, reviews, due date)
- **Card view** (current): More visual, better for reading
- **List view**: Minimal, text-focused
- Toggle between views

#### Enhanced Vocabulary Item Display

- Expandable rows/cards: Click to show more details
- Color coding: Visual indicators for due dates (red=overdue, yellow=due soon, green=not due)
- Progress indicators: Visual bars/charts for streaks, accuracy
- Icons: Status icons for different states
- Contextual badges: Multiple badges (state, due status, accuracy level)

#### Bulk Actions

- Select multiple items
- Bulk mark as reviewed
- Bulk reset progress
- Export selected vocabulary

#### View Options

- Adjustable items per page: 10, 20, 50, 100, All
- Column visibility toggle: Show/hide specific columns
- Compact/comfortable spacing

### 5. Data Aggregation & Statistics

#### Summary Statistics Panel

- Total vocabulary count
- Breakdown by state (New: X, Learning: Y, Review: Z, Relearning: W)
- Average accuracy across studied items
- Total reviews completed
- Words due soon/overdue count
- Study streak summary

#### Quick Filters Bar

- Quick filter chips: "Due Now", "New Words", "Need Review", "High Accuracy", "Low Accuracy"

### 6. Implementation Files

**Primary files to modify:**

- [`src/components/chapter/vocabularyList.tsx`](src/components/chapter/vocabularyList.tsx) - Main component
- [`src/types/series.types.ts`](src/types/series.types.ts) - Type definitions
- [`src/lib/series/chapterData.ts`](src/lib/series/chapterData.ts) - Data fetching (may need to fetch additional fields)

**Potential new files:**

- `src/components/chapter/vocabularyFilters.tsx` - Filter controls component
- `src/components/chapter/vocabularyTable.tsx` - Table view variant
- `src/components/chapter/vocabularyStats.tsx` - Statistics panel component
- `src/lib/chapter/vocabularyFilters.ts` - Filtering logic utilities
- `src/lib/chapter/vocabularySorters.ts` - Sorting utilities

## Recommended Implementation Priority

### Phase 1 (High Value, Low Effort)

1. Display additional fields: review count, last studied, next due date
2. Add text search (term and definition)
3. Filter by card state (enhance existing)
4. Sort by last studied and next due date

### Phase 2 (High Value, Medium Effort)

1. Filter by study status and due status
2. Statistics summary panel
3. Adjustable items per page
4. Color coding for due dates
5. FSRS metrics display (stability, difficulty)
6. Column visibility controls

### Phase 3 (Nice to Have)

1. Table/list view toggle
2. Bulk actions
3. Advanced filtering UI

## Considerations

- **Performance**: Some filters may require client-side filtering of all vocabulary (currently paginated)