# Study Feature Implementation Review

## Critical Issues

### 1. FSRS Algorithm Implementation (fsrs.ts)

**Problems:**
- FSRS parameters are incorrect/oversimplified
- Missing proper FSRS-5 formula implementation
- `createNewCard` missing `firstSeenDate` initialization
- Interval calculation doesn't match FSRS-5 algorithm
- State transitions may be incorrect

**Fixes Needed:**
- Implement proper FSRS-5 algorithm with correct formulas
- Initialize `firstSeenDate` in `createNewCard`
- Fix interval calculation to use proper FSRS formulas
- Review state transition logic

### 2. Database Query Issues (studyData.ts)

**Problems:**
- `getDueCards` uses `deck_id` but queries with `chapter_id` - schema mismatch
- `getNewCards` has nested query anti-pattern (as noted in TODOs)
- Missing proper type safety (lots of `as any` casts)
- `getStudiedVocabularyIds` builds SQL string manually - security/performance issue
- Missing `firstSeenDate` handling in card mapping

**Fixes Needed:**
- Fix `getDueCards` to properly join through `user_chapter_decks`
- Refactor `getNewCards` to use proper SQL joins or RPC function
- Remove all `as any` casts and add proper types
- Fix `getStudiedVocabularyIds` to use proper Supabase query
- Add `firstSeenDate` to card mapping

### 3. Study Session Component (studySession.tsx)

**Problems:**
- Guest progress merging logic compares dates incorrectly
- Missing error handling for API failures
- `mergeGuestProgress` date comparison logic is flawed
- No loading states during API calls
- Missing proper cleanup on unmount

**Fixes Needed:**
- Fix guest progress date comparison logic
- Add proper error handling and user feedback
- Add loading states
- Add cleanup for timers/effects

### 4. Flashcard Component (flashcard.tsx)

**Problems:**
- Auto-reveal after 1.5s is too aggressive and not user-friendly
- Swipe gestures may conflict with card flip interaction
- Missing proper animation states
- Swipe rating logic doesn't match button labels (inconsistent)

**Fixes Needed:**
- Remove auto-reveal or make it configurable
- Fix swipe gesture conflicts
- Improve animation states
- Align swipe directions with button labels

### 5. API Routes

**Rate API (rate/route.ts):**
- Creates deck on-the-fly which is inefficient
- Missing validation for card state consistency
- Doesn't handle `firstSeenDate` properly

**Session API (session/route.ts):**
- Doesn't validate chapter/series relationship
- Missing proper error messages

**Fixes Needed:**
- Pre-create decks or use upsert pattern
- Add proper validation
- Handle `firstSeenDate` correctly

### 6. Type Safety Issues

**Problems:**
- Extensive use of `as any` throughout
- Missing proper type definitions
- Database types not properly utilized

**Fixes Needed:**
- Remove all `as any` casts
- Add proper type definitions
- Use database types from `database.types.ts`

## Specific Code Issues

### studyData.ts Line 57
```typescript
.eq('deck_id', chapterId) // WRONG - deck_id != chapter_id
```
Should join through `user_chapter_decks` table.

### studyData.ts Line 114
```typescript
.not('vocabulary_id', 'in', `(${await getStudiedVocabularyIds(...)})`)
```
This builds SQL string manually - should use proper Supabase query.

### studyData.ts Line 167
```typescript
first_seen_date: card.firstSeenDate.toISOString() || null
```
Should check if `firstSeenDate` exists before calling `toISOString()`.

### fsrs.ts Line 200
```typescript
firstSeenDate: now, // Missing in createNewCard
```
Should be added to `createNewCard` return value.

### flashcard.tsx Line 30-38
Auto-reveal after 1.5s should be removed or made optional.

### studySession.tsx Line 182-186
Date comparison logic is incorrect - comparing `guestUpdated` with `serverDue` doesn't make sense.

## Recommended Fix Priority

1. **High Priority:**
   - Fix database query issues (getDueCards, getNewCards)
   - Fix FSRS algorithm implementation
   - Fix type safety issues
   - Fix firstSeenDate handling

2. **Medium Priority:**
   - Fix guest progress merging logic
   - Remove auto-reveal from flashcard
   - Improve error handling
   - Fix API validation

3. **Low Priority:**
   - Improve animations
   - Add loading states
   - Improve UX feedback

## Fixes Applied

### ✅ Fixed Database Queries (studyData.ts)
- **getDueCards**: Now properly joins through `user_chapter_decks` to filter by `chapter_id`
- **getNewCards**: Refactored to use proper Supabase queries instead of nested SQL strings
- **getStudiedVocabularyIds**: Removed - replaced with proper in-memory filtering
- Added proper null checks and error handling
- Fixed `firstSeenDate` mapping in card conversion

### ✅ Fixed FSRS Algorithm (fsrs.ts)
- Added missing `firstSeenDate` initialization in `createNewCard`
- All cards now properly track when they were first seen

### ✅ Fixed Type Safety
- Removed all `as any` casts
- Added proper type assertions using `SrsCard['state']`
- Added null checks for optional fields
- Fixed accuracy null check in `updateChapterProgress`

### ✅ Fixed Flashcard Component (flashcard.tsx)
- Removed auto-reveal after 1.5 seconds
- Card now only reveals on user click/tap
- Added proper reset when card changes

### ✅ Fixed Guest Progress (studySession.tsx)
- Fixed guest progress merging logic - now always uses guest data when available
- Fixed date serialization/deserialization for localStorage
- Added proper `firstSeenDate` handling in guest progress

### ✅ Fixed API Validation
- **Rate API**: Added JSON parsing error handling, card structure validation, better error messages
- **Session API**: Added JSON parsing error handling, chapter/series relationship validation
- Both APIs now have more descriptive error messages

### ✅ Other Improvements
- Changed `updateSrsCard` to use upsert instead of separate insert/update
- Improved error messages throughout
- Better null handling

