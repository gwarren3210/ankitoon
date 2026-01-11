# Future Features Specification

**Date:** January 4, 2025
**Status:** Planned
**Purpose:** Specification for upcoming features to enhance learning experience

---

## Feature 1: Series Recommendation Based on New Vocabulary

### Overview

Recommend new series to users based on the amount of new vocabulary they would need to learn. This helps users discover series that match their current skill level and learning goals.

### Goals

- Help users find series appropriate for their vocabulary level
- Reduce frustration from series that are too difficult or too easy
- Encourage progression through series of increasing difficulty

### Functionality

**Recommendation Algorithm:**
- Calculate vocabulary overlap between user's known words and series vocabulary
- Identify "new words" (vocabulary not yet studied by user)
- Rank series by:
  - Percentage of new words (target: 20-40% new words ideal)
  - Total vocabulary count
  - User's current progress across all series
  - Series popularity/completion rates

**Display:**
- Show recommendation score/badge on series cards in browse page
- "Good for you" indicator for series with optimal new word ratio
- Filter option: "Show recommended series"
- Series detail page shows: "X% new words for you"

### Data Requirements

**Database Changes:**
- Query to calculate vocabulary overlap per series per user
- Cache recommendation scores (update on study completion)

**API Endpoints:**
- `GET /api/series/recommendations` - Get recommended series for user
- Include recommendation metadata in existing series endpoints

### Implementation Considerations

- Performance: Cache recommendation calculations (update periodically)
- Guest users: Use localStorage study data for recommendations
- Edge cases: New users (no vocabulary), users who've studied everything

---

## Feature 2: Chapter Locking - Sequential Progression

### Overview

Lock subsequent chapters until the user completes previous chapters in order. This enforces a structured learning path and ensures users master vocabulary before moving forward.

### Goals

- Ensure users build vocabulary foundation before advancing
- Prevent skipping ahead to difficult content
- Create sense of progression and achievement

### Functionality

**Locking Rules:**
- Chapter 1 always unlocked
- Chapter N+1 locked until Chapter N is "completed"
- Completion criteria: User has studied all vocabulary in chapter
  - All words have been seen at least once
  - Optional: All words have been reviewed X times
  - Optional: User achieves Y% accuracy rate

**UI/UX:**
- Locked chapters show lock icon
- Disabled "Study" button with tooltip: "Complete Chapter X first"
- Progress indicator showing what's needed to unlock
- Chapter list shows: "Locked" badge on locked chapters

**Settings:**
- Admin can toggle chapter locking per series (optional)
- User setting to show/hide locked chapters (optional)

### Data Requirements

**Database Changes:**
- Query to check chapter completion status
- Function to determine if chapter should be locked
- Track "completion" state per user per chapter

**New Fields:**
- `chapters.completion_required` (boolean, default true)
- User chapter completion tracking (may already exist in study progress)

**API Changes:**
- `GET /api/series/[slug]/chapters` - Include `isLocked` field
- `GET /api/study/[slug]/[chapter]` - Return 403 if chapter locked
- `GET /api/chapters/[id]/completion-status` - Check completion

### Implementation Considerations

- Definition of "completion" needs to be clear and consistent
- Should completion be reversible? (e.g., if user forgets words)
- Consider "preview mode" for locked chapters (view vocab list only)

---

## Feature 3: Flashcard Examples - Generic vs Chapter-Specific

### Overview

Enable examples in flashcards with two types: generic examples (stored with vocabulary word) and chapter-specific examples (stored with chapter vocabulary). Users can choose in settings which type to display.

### Goals

- Provide context for vocabulary learning
- Allow users to see vocabulary in context from the actual chapter
- Support both generic usage and chapter-specific usage

### Functionality

**Data Storage:**
- `vocabulary.examples` (text[]) - Generic examples stored with word
- `chapter_vocabulary.examples` (text[]) - Chapter-specific examples
- Both fields optional (backward compatible)

**Display Logic:**
- User setting: `show_examples` (boolean)
- User setting: `example_type` ('generic' | 'chapter' | 'both')
- Flashcard back side shows example(s) below definition
- Vocabulary list on chapter page respects example visibility settings
- Format: "Example: [Korean sentence] - [English translation]"

**Admin/Data Entry:**
- Admin can add generic examples when creating vocabulary
- Admin can add chapter-specific examples when processing chapters
- Chapter examples extracted from OCR text context (where word appears)

### Data Requirements

**Database Changes:**
```sql
-- Add examples to vocabulary table
ALTER TABLE vocabulary 
ADD COLUMN examples TEXT[];

-- Add examples to chapter_vocabulary junction table
ALTER TABLE chapter_vocabulary 
ADD COLUMN examples TEXT[];
```

**Settings Schema:**
- Add to `profile_settings`:
  - `show_examples` (boolean, default false)
  - `example_type` ('generic' | 'chapter' | 'both', default 'generic')

**Settings UI:**
- Add toggle switch with animated motion in `SettingsTab` component
- Toggle for `show_examples` setting
- Respect user preference in study cards and vocabulary list
- Update API endpoint (`/api/profile/settings`) to save preference

**API Changes:**
- Include examples in vocabulary responses
- Include examples in study card responses
- Filter examples based on user settings

### Implementation Considerations

- Example extraction: Can be done during pipeline processing (OCR context)
- Translation: Examples need English translation (use Gemini)
- UI: Examples should be clearly separated from definition
- Performance: Examples add to payload size (consider lazy loading)
- Vocabulary list component: Apply example visibility settings to chapter vocabulary table (`VocabularyList` component)
- Settings integration: Load user settings in vocabulary list to control example display
- Settings tab: Add toggle switch for example visibility with animated motion

---

## Feature 4: Pronunciation/Romanization Display

### Overview

Enable users to display romanization (pronunciation) on study cards. Romanization is extracted from the `sense_key` field and displayed to help users learn pronunciation.

### Goals

- Help users learn Korean pronunciation
- Provide pronunciation guidance without requiring additional data storage
- Allow users to toggle pronunciation display based on preference

### Functionality

**Display Logic:**
- User setting: `show_pronunciation` (boolean)
- Extract romanization from `sense_key` field (format: `romanization_meaning`)
- Display romanization on study cards when enabled
- Format: Show romanization below Korean term (e.g., "먹다 (meokda)")

**Settings UI:**
- Add toggle switch with animated motion in `SettingsTab` component
- Toggle for `show_pronunciation` setting
- Update API endpoint (`/api/profile/settings`) to save preference

### Data Requirements

**Database Changes:**
- Add to `profiles` table:
  - `show_pronunciation` (boolean, default false)

**Settings Schema:**
- Add to `profile_settings`:
  - `show_pronunciation` (boolean, default false)

**API Changes:**
- Update `/api/profile/settings` endpoint to handle `show_pronunciation`
- Extract romanization from `sense_key` in study card responses
- Include romanization in study card data when setting enabled

### Implementation Considerations

- Romanization extraction: Parse `sense_key` to extract romanization part (before underscore)
- Sense key format: `{romanization}_{meaning}` (e.g., `meokda::eat` or `meokda_eat`)
- UI: Display romanization clearly below Korean term
- Fallback: If sense_key parsing fails, don't show romanization
- Performance: Minimal impact (string parsing only)

---

## Feature 5: Series-Level Review

### Overview

Enable users to review vocabulary across an entire series, not just individual chapters. This allows comprehensive review of all learned vocabulary from a series.

### Goals

- Help users review vocabulary from entire series
- Support spaced repetition across series boundaries
- Enable comprehensive study sessions

### Functionality

**Study Mode:**
- New route: `/study/[slug]` (series-level, no chapter number)
- Study all vocabulary from all chapters in series
- Respect FSRS scheduling (show due cards from any chapter)
- Session limits apply across entire series

**Card Selection:**
- Prioritize due cards from any chapter in series
- Include new cards from any chapter (if user has unlocked them)
- Order by due date (earliest first)
- Show chapter context: "From Chapter X" indicator on card

**Progress Tracking:**
- Series-level progress: "X/Y words studied in this series"
- Chapter breakdown: Show progress per chapter
- Series completion: Track when all vocabulary in series is mastered

### Data Requirements

**Database Changes:**
- Query to fetch study cards across all chapters in series
- Series-level progress tracking
- RPC function: `get_series_study_cards(user_id, series_id)`

**API Endpoints:**
- `GET /api/study/[slug]` - Get series-level study session
- `POST /api/study/[slug]/session` - Start series-level session
- `GET /api/series/[slug]/progress` - Get series-level progress

### Implementation Considerations

- Card ordering: How to prioritize cards from different chapters?
- Session limits: Should series-level sessions have different limits?
- Navigation: How to navigate between chapter-level and series-level study?
- Performance: Querying across all chapters may be slower (needs optimization)

---

## Feature 6: Rebranding - Visual Identity & Home Page ✅ DONE

### Overview

Complete visual rebranding of the application including color palette, logo, typography, home page redesign, and overall naming/branding consistency across the platform.

### Goals

- Create cohesive visual identity that reflects the learning platform
- Improve first impressions with modern, polished design
- Establish brand recognition through consistent styling
- Enhance user experience with better visual hierarchy

### Functionality

**Color Palette:**
- Define primary, secondary, and accent color scheme
- Support light/dark theme variants
- Ensure accessibility (WCAG AA contrast ratios)
- Update all UI components to use new palette
- CSS variables for theme consistency

**Logo & Branding:**
- Design new logo (or update existing)
- Favicon and app icons (various sizes)
- Brand guidelines document
- Consistent use across all pages and components

**Home Page Redesign:**
- Hero section with value proposition
- Feature highlights/call-to-action sections
- Series showcase/carousel
- User testimonials or stats (optional)
- Clear navigation to key features
- Responsive design for mobile/tablet/desktop

**Typography:**
- Select primary and secondary font families
- Define heading hierarchy (h1-h6 styles)
- Body text styling
- Code/monospace font for technical content
- Font loading strategy (web fonts, fallbacks)

**Naming & Branding:**
- Review and standardize terminology
- Update all user-facing text for consistency
- Ensure brand name usage is consistent
- Update meta tags, titles, descriptions
- Social media preview images

**Component Styling:**
- Update all UI components (buttons, cards, inputs, etc.)
- Consistent spacing and sizing system
- Border radius, shadows, and effects
- Animation/transition guidelines
- Loading states and empty states

### Data Requirements

**No Database Changes Required:**
- Visual changes only, no schema modifications

**Configuration:**
- Update `tailwind.config` or CSS variables
- Theme configuration files
- Component styling files

**Assets:**
- Logo files (SVG, PNG variants)
- Favicon files (multiple sizes)
- Social media preview images
- App icons (if PWA)

### Implementation Considerations

**Design System:**
- Create or update design tokens
- Document color usage guidelines
- Component library consistency
- Responsive breakpoints

**Migration Strategy:**
- Update components incrementally
- Maintain backward compatibility during transition
- Test across all pages and features
- Ensure dark mode support

**Performance:**
- Optimize logo/icon file sizes
- Lazy load images on home page
- Font loading strategy (preload, display swap)
- Minimize CSS bundle size

**Accessibility:**
- Color contrast compliance
- Focus states for interactive elements
- Screen reader considerations
- Keyboard navigation

**Files to Update:**
- `src/app/page.tsx` - Home page redesign
- `src/app/globals.css` - Color palette, typography
- `tailwind.config.ts` - Theme configuration
- All component files - Styling updates
- `public/` - Logo, favicon, assets
- `next.config.ts` - Meta tags, PWA config

### Design Deliverables

1. **Color Palette:**
   - Primary colors (light/dark variants)
   - Secondary colors
   - Accent colors
   - Semantic colors (success, error, warning, info)
   - Neutral grays

2. **Logo Design:**
   - Main logo (horizontal and vertical variants)
   - Icon/mark (for favicon)
   - Color and monochrome versions
   - Usage guidelines

3. **Typography Scale:**
   - Font families
   - Size scale (rem/px values)
   - Line heights
   - Letter spacing
   - Font weights

4. **Component Library:**
   - Button styles and variants
   - Card styles
   - Form input styles
   - Navigation styles
   - Modal/dialog styles

5. **Home Page Mockups:**
   - Desktop layout
   - Tablet layout
   - Mobile layout
   - Interactive states

---

## Feature 7: Refactor Supabase Client - Remove Dependency Injection

### Overview

Refactor client-side code to remove Supabase client dependency injection pattern. Functions currently receive the Supabase client as a parameter, but should import and create the client directly where needed for simpler code structure.

### Goals

- Simplify function signatures by removing client parameter
- Reduce boilerplate code in API routes and service functions
- Make code more straightforward and easier to understand
- Maintain separation between client and server Supabase usage

### Functionality

**Current Pattern:**
- Functions receive `supabase: DbClient` or `supabase: Awaited<ReturnType<typeof createClient>>` as parameter
- API routes create client and pass it to service functions
- Service functions receive client as first parameter

**Target Pattern:**
- Functions import `createClient` from appropriate module (`@/lib/supabase/client` or `@/lib/supabase/server`)
- Functions create client internally where needed
- No client parameter in function signatures

**Scope:**
- Client-side functions: Use `createClient()` from `@/lib/supabase/client`
- Server-side functions: Use `await createClient()` from `@/lib/supabase/server`
- API route handlers: Create client directly instead of passing to helpers

### Data Requirements

**No Database Changes Required:**
- Code refactoring only, no schema modifications

**Code Changes:**
- Update all service functions in `src/lib/` to create client internally
- Update API route handlers to create client directly
- Remove client parameters from function signatures
- Update function calls to remove client argument

**Files to Update:**
- `src/lib/profile/profileData.ts` - Remove supabase parameter
- `src/lib/profile/activityData.ts` - Remove supabase parameter
- `src/lib/study/*.ts` - Remove supabase parameters from all study functions
- `src/lib/series/*.ts` - Remove supabase parameters from series functions
- `src/lib/admin/auth.ts` - Remove supabase parameter
- `src/lib/pipeline/*.ts` - Remove supabase parameters from pipeline functions
- `src/app/api/**/*.ts` - Update route handlers to create client directly
- Update all call sites to remove client argument

### Implementation Considerations

**Code Organization:**
- Ensure correct client type (client vs server) based on context
- Server components and API routes: use server client
- Client components: use browser client
- Maintain type safety with `DbClient` type where appropriate

**Migration Strategy:**
- Refactor files incrementally
- Update function and all call sites together
- Test each refactored module before moving to next
- Consider helper functions that create and return client if needed

**Performance:**
- No performance impact expected (same client creation, just moved)
- Client creation is lightweight in both patterns

**Testing:**
- Verify all API endpoints still work correctly
- Test client-side components that use Supabase
- Ensure authentication flows unchanged
- Check that server vs client client usage is correct

---

## Implementation Priority

1. ✅ **Feature 6 (Rebranding)** - COMPLETED
2. **Feature 7 (Supabase Client Refactor)** - Code cleanup, improves maintainability
3. **Feature 3 (Examples)** - Enhances existing study experience, relatively straightforward
4. **Feature 4 (Pronunciation)** - Enhances study experience, straightforward implementation
5. **Feature 2 (Chapter Locking)** - Improves learning structure, moderate complexity
6. **Feature 5 (Series Review)** - Adds new study mode, requires careful design
7. **Feature 1 (Recommendations)** - Nice-to-have, requires algorithm design

---

## Dependencies

### Shared Dependencies
- User settings system (for example preferences)
- Study progress tracking (for completion status)
- Series/chapter data models

### Feature-Specific
- **Feature 1:** Recommendation algorithm, caching strategy
- **Feature 2:** Completion criteria definition, locking logic
- **Feature 3:** Example extraction in pipeline, translation service
- **Feature 4:** Sense key parsing for romanization extraction
- **Feature 5:** Cross-chapter query optimization, series progress tracking
- **Feature 6:** Design system, asset creation, component library updates
- **Feature 7:** None - pure code refactoring

---

## Open Questions

1. **Chapter Completion:** What exactly defines "completion"? (all words seen once? X reviews? Y% accuracy?)
2. **Example Extraction:** How to extract chapter examples from OCR text? (proximity? sentence boundaries?)
3. **Series Review Limits:** Should series-level sessions have different card limits than chapter-level?
4. **Recommendation Algorithm:** What's the ideal "new word percentage" range? (20-40%? user-configurable?)
5. **Locking Flexibility:** Should admins be able to disable locking for certain series? (e.g., anthology series)
6. **Rebranding Scope:** Should rebranding include domain name change? Marketing site separate from app?
7. **Color Palette:** What brand personality should colors convey? (playful? professional? educational?)
8. **Home Page Content:** What content should be featured? (stats? featured series? user testimonials?)
9. **Supabase Client Refactor:** Should we maintain any abstraction layer for client creation, or always use direct import?

---

## Related Documentation

- [Study Feature PR](../study-feature-pr.md) - Current study implementation
- [Admin Workflow](../admin-workflow.md) - Pipeline processing
- [Schema Type Definitions](../schema-type-definitions.md) - Database schema

