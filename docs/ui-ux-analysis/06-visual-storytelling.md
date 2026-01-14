# UI/UX Analysis #6: Visual Storytelling

**Severity:** MEDIUM
**Impact:** High - Core differentiator for the product
**Effort:** ~6 hours
**Affected Files:**
- `src/components/chapter/vocabularyList.tsx`
- `src/components/library/deckCard.tsx`
- `src/components/series/seriesCard.tsx`
- `src/app/browse/[slug]/[chapter]/page.tsx`
- `supabase/migrations/` (schema changes)

---

## Problem Description

Toonky's unique value proposition is learning Korean vocabulary **from
webtoons** - the context of real comic content should drive engagement and
memory retention. However, the current implementation completely disconnects
vocabulary from its visual source material.

### Current State

The app treats vocabulary as abstract data points (term + definition) rather
than words discovered in rich visual contexts.

**Key observations:**

1. **No webtoon panels displayed anywhere**
   - Chapter pages show only vocabulary tables
   - No preview of the source material
   - Users never see the comics they're learning from

2. **Library lacks visual identity**
   - `deckCard.tsx` shows text-only cards with progress bars
   - No cover art or series imagery
   - Indistinguishable from any generic flashcard app

3. **Vocabulary feels disconnected**
   - `vocabularyList.tsx` displays term, definition, and optional example
   - No indication of WHERE the word appeared (which panel, which page)
   - Missing the "aha moment" of seeing words in context

4. **No progress visualization metaphors**
   - Progress shown as percentages and numbers
   - Missing book/manga spine visual metaphor
   - No sense of "journey through the story"

### Current Implementation

```typescript
// src/components/chapter/vocabularyList.tsx - Line 434-443
<td className="p-3">
  <div className="font-semibold">{vocab.term}</div>
  {(vocab.chapterExample || vocab.example) && (
    <div className="text-sm italic text-muted-foreground mt-1">
      &quot;{vocab.chapterExample || vocab.example}&quot;
    </div>
  )}
</td>
<td className="p-3 text-muted-foreground">{vocab.definition}</td>
```

The vocabulary display is purely textual. Even when examples exist, they're
just text strings without visual context.

```typescript
// src/components/library/deckCard.tsx - Line 48-66
<CardContent className="px-4 sm:px-6">
  <div className="flex flex-col h-full space-y-3">
    {/* Series Name */}
    <Link href={`/browse/${series.slug}`}>
      {series.name}
    </Link>
    {/* Chapter Info */}
    <div>
      <h3 className="font-semibold text-lg text-muted-foreground">
        Chapter {chapter.chapter_number}
      </h3>
    </div>
```

Deck cards show no imagery whatsoever - just series name and chapter number.

---

## Implementation Requirements

### Tool Breakdown

| Tool | Percentage | Tasks |
|------|:----------:|-------|
| **Claude Code** | 60% | Components, integration, database |
| **Nanabanana Pro** | 20% | Book spine visuals, placeholders |
| **Human Decision** | 20% | Content strategy, licensing |

### Claude Code Tasks (Automatable)

These can be implemented once decisions are made:
- Cover art display component
- Panel display component
- Context card component
- Database schema updates (`chapter_panels` table)
- API routes for panel data
- Integration with study session

### Nanabanana Pro Tasks (Image Generation)

**Book Spine Visual Concept**
```
Prompt: "Book spine progress visualization for reading app,
vertical stack of colorful spines, Korean manhwa style,
progress indicator showing completion percentage,
clean vector illustration, isometric or flat design"
```

**Placeholder Panel Illustrations** (if webtoon images unavailable)
```
Prompt: "Generic webtoon panel placeholder, Korean comic style,
simple scene with speech bubble, neutral content,
could show character reading or studying, pastel colors"
```

### Human Decisions Required

Before implementation, decide:

1. **Content Display Strategy**
   - Show actual webtoon panels? (requires licensing)
   - Show cropped/blurred panels? (may still need rights)
   - Use placeholder illustrations? (Nanabanana Pro)
   - Text-only context? (safest, least visual)

2. **Webtoon Image Licensing**
   - Are images already in database (`external_url`, `picture_url`)?
   - What are the licensing terms for displaying panels?
   - Can users upload their own study materials?

3. **Context Card Content**
   - Show vocabulary word highlighted in panel?
   - Show full sentence with translation?
   - Show both panel + sentence?

### Implementation Order

```
1. Human decides content strategy (licensing, display approach)
2. If using custom visuals:
   - Generate book spine concept with Nanabanana Pro
   - Generate placeholders if needed
3. Claude Code implements:
   Phase 1: Cover art integration (2h) - uses existing series covers
   Phase 2: Panel display infrastructure (2.5h) - components + API
   Phase 3: Context cards in study (1.5h) - integrate with flashcard
```

### Partial Implementation Possible

Even without webtoon licensing decisions, Phase 1 (cover art integration)
can proceed immediately since series cover images already exist in the
database. This provides visual improvement while licensing is resolved.

```
Immediate (no decisions needed):
└── Cover art in deck cards - uses existing series.cover_url

Requires decisions:
├── Panel display - needs content strategy
└── Context cards - needs licensing clarity
```

---

## Why Visual Storytelling Matters

### 1. Context Aids Memory Retention

**Research-backed principle:** The "picture superiority effect" shows that
concepts learned with images are 65% more likely to be remembered than those
learned through text alone.

For language learning specifically:
- **Dual coding theory** - Visual + verbal encoding creates stronger memories
- **Contextual learning** - Words learned in meaningful contexts stick better
- **Emotional engagement** - Story/character connection increases motivation

### 2. Webtoons ARE the Differentiator

Other Korean learning apps offer:
- Dictionary lookups (Papago, Naver)
- Flashcard systems (Anki, Memrise)
- Textbook vocabulary (Talk To Me In Korean)

**Only AnkiToon offers:** Learning vocabulary FROM the content you love.
But currently, users don't see that content at all.

### 3. Engagement Through Narrative

Webtoon readers are story-driven. They want to:
- See their favorite characters
- Remember scenes where they learned words
- Feel progress through the narrative arc

A vocabulary list without panels is like a book summary without the book.

### 4. Visual Memory Anchors

When a user sees the word "crying" they might not remember it.
When they see the word over a panel of their favorite character crying during
a dramatic moment, they'll never forget it.

---

## Current Database State

### Existing Schema Support

The database already has some supporting infrastructure:

```sql
-- chapters table
external_url TEXT  -- Link to original webtoon source

-- chapter_vocabulary table
example TEXT       -- Text example from chapter (added in migration)
importance_score INTEGER  -- Could correlate with panel significance

-- series table
picture_url TEXT   -- Series cover image (already used in seriesCard.tsx)
```

### What's Missing

```sql
-- No panel/page references
-- No image storage for extracted panels
-- No position data (where word appeared in image)
-- No page numbers linking vocabulary to source
```

---

## Recommended Solutions

### Solution 1: Cover Art Integration (Phase 1)

**Goal:** Make the library visually rich and recognizable.

**Changes to `deckCard.tsx`:**

```typescript
// Current: Text-only card
<Card className="h-full">
  <CardContent>
    <Link>{series.name}</Link>
    <h3>Chapter {chapter.chapter_number}</h3>
  </CardContent>
</Card>

// Proposed: Cover-led card with visual progress
<Card className="h-full overflow-hidden">
  <div className="relative aspect-[3/4] w-24 flex-shrink-0">
    {series.picture_url && (
      <Image
        src={series.picture_url}
        alt={series.name}
        fill
        className="object-cover"
      />
    )}
    {/* Progress overlay as "bookmark" */}
    <div
      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t
                 from-black/60 to-transparent p-2"
    >
      <div className="text-xs text-white font-medium">
        Ch. {chapter.chapter_number}
      </div>
    </div>
  </div>
  <CardContent>
    <Link>{series.name}</Link>
    {/* Progress as visual bar */}
  </CardContent>
</Card>
```

**Mockup Description:**

```
+------------------------------------------+
|  +--------+  Series Name                 |
|  | COVER  |  Chapter 12                  |
|  | IMAGE  |  ========================== |
|  | Ch.12  |  45/60 cards studied         |
|  +--------+  Due: 5 now, 3 later today   |
+------------------------------------------+
```

The cover image creates instant recognition - users see their webtoon, not
just text.

---

### Solution 2: Panel Display in Chapter Detail (Phase 2)

**Goal:** Show source material alongside vocabulary.

**New Component: `ChapterPanelViewer`**

Display webtoon panels with vocabulary overlays or highlights.

**Database Changes Required:**

```sql
-- New table: chapter_panels
CREATE TABLE chapter_panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  panel_number INTEGER,  -- Optional, for multi-panel pages
  image_url TEXT NOT NULL,
  panel_bbox JSONB,  -- Bounding box if extracted from larger image
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (chapter_id, page_number, panel_number)
);

-- Link vocabulary to panels
ALTER TABLE chapter_vocabulary
ADD COLUMN panel_id UUID REFERENCES chapter_panels(id);

-- Position of word in panel (for highlighting)
ALTER TABLE chapter_vocabulary
ADD COLUMN text_bbox JSONB;  -- {x, y, width, height} in panel coordinates
```

**UI Component:**

```typescript
// src/components/chapter/chapterPanelViewer.tsx
interface PanelViewerProps {
  panels: ChapterPanel[]
  vocabulary: ChapterVocabulary[]
  currentVocabId?: string  // Highlight specific word
}

export function ChapterPanelViewer({
  panels,
  vocabulary,
  currentVocabId
}: PanelViewerProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {panels.map(panel => (
        <div key={panel.id} className="relative">
          <Image
            src={panel.image_url}
            alt={`Page ${panel.page_number}`}
            className="rounded-lg"
          />
          {/* Highlight vocabulary positions */}
          {vocabulary
            .filter(v => v.panelId === panel.id)
            .map(vocab => (
              <VocabHighlight
                key={vocab.id}
                vocab={vocab}
                isActive={vocab.id === currentVocabId}
              />
            ))}
        </div>
      ))}
    </div>
  )
}
```

**Mockup Description:**

```
+------------------------------------------+
| Chapter 12 - Solo Leveling               |
+------------------------------------------+
| [Panel Image 1]     [Panel Image 2]      |
| +----------------+  +----------------+   |
| |  +---------+  |  |                 |   |
| |  | Highlighted|  |   Comic panel   |   |
| |  | Korean    |  |   with story    |   |
| |  | text      |  |                 |   |
| |  +---------+  |  |                 |   |
| +----------------+  +----------------+   |
|                                          |
| Vocabulary from this panel:              |
| - 일어나다 (to wake up)                    |
| - 힘들다 (to be difficult)                 |
+------------------------------------------+
```

---

### Solution 3: Context Cards in Study Session (Phase 3)

**Goal:** Show vocabulary in original context during review.

**Enhanced Flashcard Component:**

```typescript
// src/components/study/contextFlashcard.tsx
interface ContextFlashcardProps {
  card: StudyCard
  showContext: boolean  // Toggle between minimal and context view
}

export function ContextFlashcard({ card, showContext }: ContextFlashcardProps) {
  return (
    <div className="relative">
      {/* Context panel (when enabled) */}
      {showContext && card.panelImageUrl && (
        <div className="mb-4 rounded-lg overflow-hidden">
          <Image
            src={card.panelImageUrl}
            alt="Source panel"
            className="w-full opacity-80"
          />
          {/* Highlight the word position if available */}
          {card.textBbox && (
            <WordHighlight bbox={card.textBbox} />
          )}
        </div>
      )}

      {/* Standard flashcard */}
      <Card>
        <CardContent>
          <div className="text-4xl font-bold text-center">
            {card.term}
          </div>
          {!card.isRevealed && (
            <p className="text-sm text-muted-foreground text-center mt-2">
              From {card.seriesName}, Chapter {card.chapterNumber}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

**User Setting:**

```typescript
// Add to profile settings
interface ProfileSettings {
  // ... existing settings
  showContextInStudy: boolean  // Default: true
  contextImageSize: 'small' | 'medium' | 'large'  // Default: 'medium'
}
```

---

### Solution 4: Book Spine Progress Visualization

**Goal:** Create visual metaphor of reading progress through a series.

**Component: `SeriesSpine`**

```typescript
// src/components/series/seriesSpine.tsx
interface SeriesSpineProps {
  series: Series
  chapters: Chapter[]
  progress: ChapterProgress[]
}

export function SeriesSpine({ series, chapters, progress }: SeriesSpineProps) {
  return (
    <div className="flex gap-0.5 h-32">
      {chapters.map((chapter, index) => {
        const chapterProgress = progress.find(
          p => p.chapter_id === chapter.id
        )
        const progressPercent = chapterProgress
          ? (chapterProgress.num_cards_studied / chapterProgress.total_cards) * 100
          : 0

        return (
          <Link
            key={chapter.id}
            href={`/browse/${series.slug}/${chapter.chapter_number}`}
            className="relative flex-1 max-w-3 min-w-1.5"
          >
            {/* Spine segment */}
            <div
              className="h-full bg-muted rounded-sm relative overflow-hidden
                         hover:bg-muted/80 transition-colors"
            >
              {/* Progress fill from bottom */}
              <div
                className="absolute bottom-0 left-0 right-0 bg-brand-green"
                style={{ height: `${progressPercent}%` }}
              />

              {/* Completed indicator */}
              {chapterProgress?.completed && (
                <div className="absolute inset-0 bg-brand-green" />
              )}
            </div>

            {/* Chapter number tooltip on hover */}
            <span className="sr-only">Chapter {chapter.chapter_number}</span>
          </Link>
        )
      })}
    </div>
  )
}
```

**Mockup Description:**

```
Series: Solo Leveling (179 chapters)

[|||||||||||||||||||||||||||||||||||||||||||]
 ^              ^                          ^
 Green=Complete Yellow=In Progress        Gray=Not Started

Hover over any segment to see: "Chapter 45 - 32/40 words studied"
```

This creates a visual "bookshelf" or "manga spine" that shows at a glance how
far through a series a user has progressed.

---

## Database/Schema Considerations

### New Tables

```sql
-- Panel storage for visual context
CREATE TABLE chapter_panels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  panel_number INTEGER,
  image_url TEXT NOT NULL,  -- Supabase Storage URL
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (chapter_id, page_number, COALESCE(panel_number, 0))
);

CREATE INDEX idx_chapter_panels_chapter ON chapter_panels(chapter_id);
```

### Schema Modifications

```sql
-- Link vocabulary to visual context
ALTER TABLE chapter_vocabulary
ADD COLUMN panel_id UUID REFERENCES chapter_panels(id),
ADD COLUMN text_bbox JSONB,  -- Position in panel
ADD COLUMN page_number INTEGER;  -- Quick reference without join
```

### Storage Considerations

**Supabase Storage bucket for panels:**
- `panels/` bucket with public read access
- Path structure: `{series_slug}/{chapter_number}/{page_number}.webp`
- WebP format for best compression/quality balance
- Thumbnail generation for list views (200px width)

**Estimated storage per chapter:**
- 20 panels average per chapter
- 100KB average per panel (compressed WebP)
- = ~2MB per chapter
- = ~200MB per 100-chapter series

---

## Implementation Steps

### Phase 1: Cover Art Integration (2 hours)

**Priority:** High - Minimal effort, high visual impact

1. **Update `deckCard.tsx`** (1 hour)
   - Add series cover thumbnail
   - Create card layout with image + text
   - Add progress indicator overlay on image

2. **Update library grid** (30 min)
   - Adjust grid spacing for image cards
   - Ensure responsive behavior

3. **Test and polish** (30 min)
   - Fallback for missing images
   - Loading states
   - Dark mode appearance

**Files Modified:**
- `src/components/library/deckCard.tsx`
- `src/components/library/libraryGrid.tsx` (if needed)

---

### Phase 2: Panel Display Infrastructure (2.5 hours)

**Priority:** Medium - Requires schema changes but enables core feature

1. **Create migration** (30 min)
   ```sql
   -- Create chapter_panels table
   -- Add panel_id to chapter_vocabulary
   -- Add text_bbox to chapter_vocabulary
   ```

2. **Update pipeline** (1 hour)
   - Modify `processImage` to store panel references
   - Save OCR bounding boxes as text_bbox
   - Store panel images in Supabase Storage

3. **Create panel viewer component** (1 hour)
   - `ChapterPanelViewer` component
   - Vocabulary highlight overlay
   - Responsive image display

**Files Created:**
- `supabase/migrations/YYYYMMDD_add_chapter_panels.sql`
- `src/components/chapter/chapterPanelViewer.tsx`

**Files Modified:**
- `src/lib/pipeline/orchestrator.ts`
- `src/app/browse/[slug]/[chapter]/page.tsx`

---

### Phase 3: Context Cards in Study (1.5 hours)

**Priority:** Medium - Enhances study experience significantly

1. **Extend study card types** (30 min)
   - Add `panelImageUrl` and `textBbox` to `StudyCard` type
   - Update `get_study_cards` RPC to include panel data

2. **Create context flashcard variant** (45 min)
   - `ContextFlashcard` component
   - Toggle between minimal and context views
   - Image loading and caching

3. **Add user preference** (15 min)
   - Setting in profile for context display
   - Default to enabled

**Files Modified:**
- `src/types/study.types.ts`
- `src/components/study/flashcard.tsx`
- `src/lib/profile/profileService.ts`

---

## UI Mockup Descriptions

### Library View (After Implementation)

```
+--------------------------------------------------+
| My Library                              [Filter] |
+--------------------------------------------------+
|                                                  |
| +------------+  +------------+  +------------+   |
| |   COVER   |  |   COVER   |  |   COVER   |   |
| |   IMAGE   |  |   IMAGE   |  |   IMAGE   |   |
| |   ----    |  |   ----    |  |   ----    |   |
| |  Ch. 12   |  |  Ch. 45   |  |  Ch. 3    |   |
| +------------+  +------------+  +------------+   |
| Solo Leveling   Tower of God   Omniscient       |
| 45/60 studied   12/30 studied  0/25 studied     |
| 5 due now       All done       New deck         |
|                                                  |
+--------------------------------------------------+
```

### Chapter Detail (After Implementation)

```
+--------------------------------------------------+
| < Solo Leveling                    Chapter 12 >  |
+--------------------------------------------------+
|                                                  |
| [=====Panel Gallery=====]                        |
| +--------+ +--------+ +--------+ +--------+      |
| |  Pg 1  | |  Pg 2  | |  Pg 3  | |  Pg 4  |      |
| +--------+ +--------+ +--------+ +--------+      |
|                                                  |
| Click a panel to see vocabulary from that page   |
|                                                  |
+--------------------------------------------------+
| Vocabulary (42 words)                            |
|--------------------------------------------------|
| Term       | Definition      | Page | State     |
|--------------------------------------------------|
| 일어나다     | to wake up      | 3    | Learning  |
| 힘들다      | to be difficult | 5    | New       |
+--------------------------------------------------+
```

### Study Session with Context

```
+--------------------------------------------------+
|                                                  |
| [Panel image from webtoon showing the word]      |
| +--------------------------------------------+   |
| |                                            |   |
| |    Comic panel with [highlighted] word     |   |
| |                                            |   |
| +--------------------------------------------+   |
|                                                  |
| +--------------------------------------------+   |
| |                                            |   |
| |            일어나다                          |   |
| |                                            |   |
| |  "From Solo Leveling, Chapter 12, Page 3"  |   |
| |                                            |   |
| +--------------------------------------------+   |
|                                                  |
| [Again]  [Hard]  [Good]  [Easy]                  |
+--------------------------------------------------+
```

---

## Success Criteria

### Quantitative

- [ ] 100% of deck cards display series cover art (when available)
- [ ] Panel images load in < 500ms on fast 3G
- [ ] Storage usage < 5MB per chapter (compressed)
- [ ] Context toggle adds < 100ms to card display

### Qualitative

- [ ] Users can identify series at a glance in library
- [ ] Study sessions feel connected to source material
- [ ] Progress visualization creates sense of journey
- [ ] Vocabulary words have visual memory anchors

### User Feedback Indicators

- [ ] "I can see where I learned this word" - context working
- [ ] "My library looks like a bookshelf" - visual identity achieved
- [ ] "Studying feels like reading the webtoon" - integration successful

---

## Risks and Mitigations

### Risk 1: Copyright Concerns

**Issue:** Displaying webtoon panels may raise copyright issues.

**Mitigation:**
- Panels used for educational context only
- Link to original source (external_url exists)
- User uploads their own panels (like current workflow)
- Add attribution to original webtoon

### Risk 2: Storage Costs

**Issue:** Panel images increase storage requirements significantly.

**Mitigation:**
- WebP compression (60-80% smaller than PNG)
- Generate thumbnails for list views
- Lazy loading for off-screen panels
- Optional: Allow users to disable panel storage

### Risk 3: Performance Impact

**Issue:** Loading images may slow down study sessions.

**Mitigation:**
- Preload next card's panel during current review
- Cache panels in service worker
- Fallback to text-only if image fails
- User setting to disable context images

---

## References

- **Picture Superiority Effect:** Paivio, A. (1971). Imagery and Verbal
  Processes
- **Dual Coding Theory:** Clark, J. M., & Paivio, A. (1991). Educational
  Psychology Review
- **Contextual Learning:** Craik, F. I., & Lockhart, R. S. (1972). Journal of
  Verbal Learning and Verbal Behavior

---

## Related Documents

- `docs/implementation-patterns.md` - Next.js patterns for image handling
- `docs/sense-key-architecture.md` - Vocabulary data model
- `docs/ui-ux-analysis/README.md` - Full UI/UX analysis overview
- `supabase/migrations/20251224224932_add_chapter_external_url.sql` -
  External URL field

---

**Last Updated:** 2026-01-12
**Author:** UI/UX Analysis
**Status:** Proposed
