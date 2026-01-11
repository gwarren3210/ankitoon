# Logging Guidelines

**Last Updated:** January 2026

This document defines strategic logging practices for the AnkiToon
codebase to maintain observability while minimizing noise and
performance overhead.

---

## Philosophy

**Log what helps debug production issues, not what documents code
execution.**

Logs should capture:
- **Failures** - What went wrong and why
- **State Transitions** - Significant business events
- **External Dependencies** - API calls, database issues, third-party
  service failures

Logs should NOT capture:
- Routine success cases for simple operations
- Progress through code execution paths
- Information already available in error handlers or responses

---

## When to Log

### 1. Error Cases (logger.error)

**Always log errors with full context:**
```typescript
// Good: Full context for debugging
logger.error(
  { userId: user.id, seriesId, error },
  'Failed to create series'
)

// Good: Include operation details
logger.error(
  { seriesId, chapterNumber, error },
  'Chapter validation error'
)
```

**Context objects should include:**
- User/resource identifiers (userId, seriesId, chapterId, etc.)
- Operation parameters that could affect the outcome
- The error object itself
- Any domain-specific context (state before failure)

### 2. Significant State Transitions (logger.info)

**Log meaningful business events:**
```typescript
// Good: File upload is a significant operation
logger.info(
  { userId: user.id, avatarUrl: publicUrl },
  'Avatar uploaded successfully'
)

// Good: Series creation is a key business event
logger.info(
  { userId: user.id, seriesId: series.id, slug, name: series.name },
  'Series created successfully'
)

// Good: Image processing pipeline completion
logger.info(
  {
    seriesSlug: result.seriesSlug,
    chapterNumber: result.chapterNumber,
    chapterId: result.chapterId,
    newWordsInserted: result.newWordsInserted,
    totalWordsInChapter: result.totalWordsInChapter,
    dialogueLinesCount: result.dialogueLinesCount,
    wordsExtracted: result.wordsExtracted
  },
  'Image processed successfully'
)
```

**What qualifies as "significant":**
- File uploads/downloads
- Database migrations or schema changes
- Session creation/deletion
- Pipeline processing completion (OCR, translation)
- External API calls (MAL, OCR.space, Gemini)

### 3. External Service Failures (logger.error)

**Log when external dependencies fail:**
```typescript
// Good: API failure with response details
logger.error({ query, response }, 'MAL API error')

// Good: Database error with query context
logger.error({ query, error }, 'DB search error')
```

---

## When NOT to Log

### 1. Simple CRUD Success Cases

**Avoid logging routine database updates:**
```typescript
// Bad: Unnecessary success log
logger.info({ userId: user.id, updates }, 'Profile updated successfully')
return successResponse({ profile: updatedProfile })

// Good: Only log on error, success is implied by response
if (updateError) {
  logger.error({ userId: user.id, updateError }, 'Error updating profile')
  throw new DatabaseError('Failed to update profile', updateError)
}
return successResponse({ profile: updatedProfile })
```

**Why:** Success is already communicated via HTTP response. Error logs
capture failures. Logging every successful update creates noise.

### 2. High-Frequency Operations

**Avoid logging per-iteration events:**
```typescript
// Bad: Logs 50+ times per study session
logger.info({
  userId: user.id,
  sessionId,
  vocabularyId,
  rating,
  reAddCard,
  newStability: gradedCard.card.stability,
  newDifficulty: gradedCard.card.difficulty,
  nextReview: gradedCard.card.due.toISOString()
}, 'Card rated successfully')

// Good: No logging for routine card ratings
// Session summary is logged at session end
```

**Why:** High-frequency logs (card ratings, pagination requests, search
queries) create massive log volume without proportional debugging value.

### 3. Debug/Progress Logs

**Avoid sequential step tracking:**
```typescript
// Bad: Multiple logs for sequential steps
logger.info({ zipName: zip.name, zipSize: zip.size }, 'Processing zip')
const imageBuffers = await extractImagesFromZip(zipBuffer)
logger.info({ imageCount: imageBuffers.length }, 'Extracted images')
imageBuffer = await stitchImageBuffers(imageBuffers)
logger.info({ stitchedSize: imageBuffer.length }, 'Stitched images')

// Good: Single completion log with full context
const imageBuffers = await extractImagesFromZip(zipBuffer)
imageBuffer = await stitchImageBuffers(imageBuffers)
// Final result logged after entire pipeline completes
```

**Why:** Intermediate progress logs clutter output. Log the final result
with comprehensive context instead.

### 4. Empty Query or Validation Warnings

**Avoid logging expected edge cases:**
```typescript
// Bad: Logging expected behavior
if (!query) {
  logger.warn({ userId: user.id }, 'Empty search query')
  return successResponse({ dbResults: [], malResults: [] })
}

// Good: Handle gracefully without logging
if (!query) {
  return successResponse({ dbResults: [], malResults: [] })
}
```

**Why:** Empty queries, missing optional parameters, and similar
validations are expected behavior, not anomalies.

---

## Log Levels

### logger.error

**Use for:**
- Database query failures
- External API failures (OCR, Gemini, MAL)
- File upload/storage failures
- Authentication/authorization failures
- Data validation failures that prevent operations
- Unexpected exceptions

**Context requirements:**
- User/resource identifiers
- Operation parameters
- Error object with stack trace
- State before failure (if relevant)

### logger.info

**Use for:**
- Significant state transitions (session start/end, file uploads)
- Successful completion of complex operations (pipeline processing)
- External service calls (API requests to MAL, OCR)
- Administrative operations (series creation)

**Context requirements:**
- User/resource identifiers
- Result summary (counts, IDs, metrics)
- Timestamps for duration-sensitive operations

### logger.warn

**Use sparingly for:**
- Degraded performance (slow queries, rate limiting)
- Deprecated feature usage
- Configuration issues that don't prevent operation

**Note:** Most cases that seem like warnings are either errors (should
fail) or expected behavior (shouldn't log).

### logger.debug

**Avoid in production code.**

Use logger.info with detailed context instead. Debug logs that are
valuable enough to keep should be info logs.

---

## Context Object Patterns

### Standard Fields

Include these fields when applicable:
- `userId` - User performing the operation
- `sessionId` - Study session identifier
- `seriesId` / `seriesSlug` - Series being accessed
- `chapterId` / `chapterNumber` - Chapter being accessed
- `vocabularyId` - Vocabulary item being studied
- `error` - Error object with message and stack trace

### Error Context Pattern

```typescript
logger.error(
  {
    userId: user.id,
    resourceId: resource.id,
    operationParams: { /* relevant params */ },
    error
  },
  'Operation failed'
)
```

### Success Context Pattern

```typescript
logger.info(
  {
    userId: user.id,
    resourceId: resource.id,
    resultMetrics: { /* counts, durations, etc */ }
  },
  'Operation completed successfully'
)
```

---

## Examples

### Good: Error Logging

```typescript
// API route error handling
if (uploadError) {
  logger.error(
    { userId: user.id, uploadError },
    'Error uploading avatar'
  )
  throw new DatabaseError('Failed to upload avatar', uploadError)
}

// Service layer error
if (error && error.code !== 'PGRST116') {
  logger.error(
    { seriesId, chapterNumber, error },
    'Chapter validation error'
  )
  throw new Error('Validation failed')
}
```

### Good: Significant State Transition

```typescript
// Image processing completion
logger.info(
  {
    seriesSlug: result.seriesSlug,
    chapterNumber: result.chapterNumber,
    chapterId: result.chapterId,
    newWordsInserted: result.newWordsInserted,
    totalWordsInChapter: result.totalWordsInChapter,
    dialogueLinesCount: result.dialogueLinesCount,
    wordsExtracted: result.wordsExtracted
  },
  'Image processed successfully'
)
```

### Bad: Routine Success Logging

```typescript
// Don't log simple updates
logger.info({ userId: user.id, updates }, 'Settings updated')

// Don't log high-frequency operations
logger.info({ userId, sessionId, vocabularyId, rating }, 'Card rated')
```

### Bad: Debug/Progress Logging

```typescript
// Don't log sequential steps
logger.debug({ userId: user.id, query }, 'Starting series search')
const dbResults = await searchDatabase(supabase, query)
logger.info({ dbResultCount: dbResults.length }, 'Search completed')

// Instead: Just log on error, let success response speak for itself
```

---

## Anti-Patterns to Avoid

### 1. Log Duplication

**Bad:**
```typescript
logger.debug({ userId, operation: 'start' }, 'Starting operation')
// ... operation ...
logger.info({ userId, operation: 'complete' }, 'Operation completed')
```

**Why:** The info log contains all the useful information. The debug log
adds no value.

### 2. Logging in Loops

**Bad:**
```typescript
for (const card of cards) {
  logger.info({ cardId: card.id }, 'Processing card')
  await processCard(card)
}
```

**Good:**
```typescript
const results = await Promise.all(cards.map(processCard))
logger.info({ cardCount: cards.length }, 'Processed all cards')
```

### 3. Logging Before Error Handler

**Bad:**
```typescript
if (error) {
  logger.error({ error }, 'Database error')
  throw new DatabaseError('Query failed', error)
}
```

**Good:**
```typescript
if (error) {
  logger.error({ userId, queryParams, error }, 'Database error')
  throw new DatabaseError('Query failed', error)
}
```

**Why:** Include context that helps debug the issue (userId, params),
not just the error.

### 4. Logging User Input Directly

**Bad:**
```typescript
logger.info({ password, email }, 'User login attempt')
```

**Good:**
```typescript
logger.error({ userId, email }, 'Login failed')
```

**Why:** Never log sensitive data (passwords, tokens, PII). Log
identifiers only.

---

## Implementation Checklist

When adding logging to a new API route or function:

- [ ] Error logs include full context (userId, params, error object)
- [ ] Success logs only for significant state transitions (not CRUD)
- [ ] No debug logs (use info with context instead)
- [ ] No logs for high-frequency operations (per-card, per-query)
- [ ] No logs for expected edge cases (empty query, missing optional
      params)
- [ ] Context objects include relevant identifiers for debugging
- [ ] Log messages are clear and actionable
- [ ] No sensitive data in logs (passwords, tokens, PII)

---

## Monitoring and Alerts

Logs are ingested by our logging infrastructure for:

- **Error Rate Monitoring** - Alert on spikes in error logs
- **Performance Tracking** - Track durations of significant operations
- **Audit Trail** - Track administrative operations (series creation,
  chapter uploads)

**Current Stats:**
- 19 logger calls across 10 API route files (January 2026)
- ~70% error logs, ~30% info logs
- Focus on errors and significant state transitions

---

## Related Documentation

- `docs/code-quality-analysis.md` - Overall code quality metrics
- `docs/implementation-patterns.md` - Next.js + Supabase patterns
- `CLAUDE.md` - Architecture overview
