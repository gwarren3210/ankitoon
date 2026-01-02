# AnkiToon - Complete Project Description for Build from Scratch

## Project Overview

AnkiToon is a Korean language learning web application that helps users learn vocabulary through interactive flashcards generated from popular Korean webtoons (digital comics). The platform combines spaced repetition algorithms with content from Korean webtoons to create an engaging, contextual learning experience.

**Core Value Proposition:** Learn Korean vocabulary naturally through content you enjoy (webtoons) with scientifically-backed spaced repetition scheduling for optimal retention.

---

## User Types & Roles

### 1. Regular Users
- Browse available webtoon series and chapters
- Study vocabulary using flashcard interface
- Track learning progress and statistics
- View personalized study sessions and analytics
- Support for both authenticated users and anonymous/guest users

### 2. Administrators
- Upload webtoon screenshots to create new chapter content
- Search for existing series or create new ones from external APIs
- Process images to extract Korean text and generate vocabulary flashcards
- Manage series and chapter content

---

## Core Features

### Feature 1: Series & Chapter Browsing

**Purpose:** Users discover and navigate available webtoon series and chapters.

**Functionality:**
- Browse page displaying all available series in a grid/list layout
- Each series shows: cover image, title, synopsis, genre tags, popularity score, vocabulary statistics
- Search/filter series by name, genre, popularity
- Click series to view series detail page showing all chapters
- Each chapter shows: chapter number, title, vocabulary count, user progress (if authenticated)
- Click chapter to view chapter detail page with vocabulary list
- Navigation between chapters within a series (previous/next)
- Progress indicators showing completion status for authenticated users
- Guest users can browse but with limited functionality

**Data Displayed:**
- Series metadata: name (English and Korean), cover image, synopsis, genres, authors, popularity, number of chapters
- Chapter metadata: chapter number, title, vocabulary count
- Progress data (for authenticated users): cards studied, completion percentage, last studied date
- Vocabulary list: Korean term, English definition, example sentence, importance score

---

### Feature 2: Flashcard Study System

**Purpose:** Interactive spaced repetition study sessions using FSRS (Free Spaced Repetition Scheduler) algorithm.

**Study Session Flow:**
1. User navigates to study page for a specific chapter
2. System retrieves study cards (mix of new cards and due cards for review)
3. User studies cards one at a time with flip-to-reveal interface
4. User rates each card: Again (1), Hard (2), Good (3), Easy (4)
5. System schedules next review using FSRS algorithm based on rating
6. Session continues until all cards in session are completed
7. Session summary displays statistics: cards reviewed, accuracy, time spent, upcoming reviews

**Flashcard Interface Requirements:**
- Korean term displayed on front of card
- English definition displayed on back of card (after flip)
- Example sentence (if available) shown on back
- Smooth flip animation (60fps, no lag)
- Multiple input methods: keyboard shortcuts (1-4 keys for rating, spacebar for flip), swipe gestures, button clicks
- Swipe gestures: left=Again, right=Good, down=Hard, up=Easy
- Progress bar showing current card position and completion percentage
- Session stats panel showing: new cards, learning cards, reviewing cards, mastered cards

**FSRS Algorithm Requirements:**
- Use FSRS-5 algorithm for optimal spaced repetition scheduling
- Card states: New, Learning, Reviewing, Mastered
- Card properties: stability, difficulty, due date, elapsed days, scheduled days, learning steps, review count, lapse count
- Rating system: 4 ratings (Again=1, Hard=2, Good=3, Easy=4)
- When user rates a card, algorithm calculates:
  - Next review date (when card is due again)
  - Updated stability and difficulty values
  - State transition (new → learning → reviewing → mastered)
- Preview next review intervals for each rating option before rating
- Cards rated as "Again" may be re-added to current session if due soon

**Session Management:**
- Session limits: configurable new cards per session (default: 5), maximum total cards per session (default: 20)
- Session persistence: active sessions should be cached temporarily
- Batch processing: progress updates sent in batches to optimize performance
- Session summary: cards reviewed, average rating, time spent, breakdown by rating type
- Next review preview: how many cards due tomorrow/this week

**Guest User Support:**
- Guest users can study with temporary progress tracking (client-side storage)
- Progress can be merged when guest converts to authenticated account
- Warning banner displayed for guest users about data limitations

---

### Feature 3: Progress Tracking & Analytics

**Purpose:** Users track their learning progress and view detailed statistics.

**Dashboard Features:**
- Overall statistics: total words learned, words mastered (percentage), current streak, cards due today
- Progress charts: vocabulary growth over time, study time per day, accuracy trends
- Series breakdown: top series by cards reviewed, time spent per series, per-chapter progress
- Activity heatmap: visual calendar showing study activity
- Upcoming reviews: cards due today/this week with estimated review time
- Recent activity: list of recent study sessions with stats

**Progress Metrics:**
- Cards studied count
- Cards mastered count
- Accuracy rate (average rating)
- Time spent studying (total and per session)
- Current streak (consecutive days studied)
- Longest streak achieved
- Completion status per chapter/series

---

### Feature 4: Admin Content Creation Workflow

**Purpose:** Administrators create new chapter content by uploading webtoon screenshots.

**Workflow Steps:**

**Step 1: Series Selection**
- Admin types series name in search field
- System searches: (1) existing series in database, (2) external webtoon/manga database API for new series
- Results displayed in dropdown with existing vs new options
- Admin selects existing series (immediately selected) OR new series from API (creates new series in database, then selected)
- Series data includes: name, Korean name, alternate names, cover image, synopsis, genres, authors, popularity score

**Step 2: Chapter Number Input**
- Admin enters chapter number (positive integer)
- System validates: chapter must not already exist for selected series
- Real-time validation feedback (validating, error if duplicate, success if available)
- Chapter title is optional

**Step 3: Image Upload**
- Admin uploads webtoon screenshot via drag-and-drop or file picker
- Supported formats: PNG, JPG, WEBP
- Max file size: 10MB
- Preview displayed after upload

**Step 4: Image Processing Pipeline**
- Admin clicks "Process Image" button
- System processes image through pipeline:
  1. **Upscaling (optional)**: Enhance image quality for better text recognition accuracy
  2. **Tiling (if needed)**: Split large images into manageable sections for text recognition processing
  3. **OCR (Optical Character Recognition)**: Extract Korean text from image using OCR service
     - Returns text with bounding box coordinates
     - Processes sections in parallel if image was tiled
  4. **Text Grouping**: Group OCR results by vertical proximity (speech bubbles/dialogue lines)
     - Combines words into dialogue lines
     - Uses text position for reading order
  5. **Vocabulary Extraction**: Use AI/NLP service to extract vocabulary words from dialogue
     - Returns: Korean term, English translation, importance score, sense_key (for disambiguation)
     - Filters and validates extracted words
  6. **Database Storage**: 
     - Create/get chapter record
     - Batch insert new vocabulary (deduplicates by term + sense_key)
     - Link vocabulary to chapter with importance scores
- Processing status displayed: success with word count, or error message
- On success: link to view created chapter

**Vocabulary Disambiguation:**
- Sense key system handles homonyms (same Korean word, different meanings) and synonyms (same word, different English formatting)
- Example: "사과" (sagwa) can mean "apple" (fruit) or "apology" - each gets unique sense_key
- Deduplication prevents storing duplicate vocabulary entries

---

### Feature 5: User Authentication & Profiles

**Purpose:** User accounts, authentication, and profile management.

**Authentication:**
- Email/password signup and login
- Support for anonymous/guest accounts (temporary, can convert to full account)
- Session management with automatic token refresh
- Password reset functionality

**User Profiles:**
- Profile data: username, email, avatar image (stored in cloud storage)
- Profile settings: study preferences, theme preferences (light/dark mode)
- Account management: change password, delete account
- Guest conversion: merge guest progress when converting to authenticated account

**Authorization:**
- Data isolation: users can only access their own data (decks, progress, SRS cards)
- Admin role: special role for content creation access
- Public data: series, chapters, vocabulary are publicly viewable (read-only)

---

## Technical Requirements

### Infrastructure Needs

**Database:**
- Relational database to store: users, series, chapters, vocabulary, study progress, SRS cards
- Support for JSON data types (for arrays, learning steps)
- Foreign key constraints for data integrity
- Unique constraints to prevent duplicates
- Efficient indexing for query performance
- User data isolation/access control

**Authentication:**
- User authentication system (email/password)
- Session management
- Password reset functionality
- Support for anonymous/guest accounts

**Storage:**
- Cloud storage for user avatars
- Image upload capability

**External Services Required:**
- OCR service capable of Korean text extraction from images
- AI/NLP service for vocabulary extraction and translation from Korean dialogue
- Optional: Webtoon/manga database API for series metadata lookup

**Backend API:**
- REST API endpoints for all operations
- Support for image upload and processing
- Batch operations for performance

---

## Database Schema Requirements

### Core Tables

**profiles**
- User profile data: id (UUID, references auth.users), username, email, avatar_url, created_at, updated_at, role (admin/user)

**series**
- Webtoon series: id (UUID), name, korean_name, alt_names (array), slug (unique), picture_url, synopsis, popularity, genres (array), authors (array), num_chapters, created_at, updated_at

**chapters**
- Chapter data: id (UUID), series_id (references series), chapter_number, title, created_at, unique constraint on (series_id, chapter_number)

**vocabulary**
- Vocabulary words: id (UUID), term (Korean word), definition (English), example (sentence), sense_key (for disambiguation), created_at

**chapter_vocabulary** (join table)
- Links vocabulary to chapters: id (UUID), chapter_id, vocabulary_id, importance_score, unique constraint on (chapter_id, vocabulary_id)

**user_chapter_decks**
- User's deck for a chapter: id (UUID), name, user_id (references profiles), chapter_id (references chapters), created_at, updated_at

**user_deck_srs_cards**
- SRS tracking for individual vocabulary cards: id (UUID), deck_id, vocabulary_id, user_id, state (enum: new/learning/reviewing/mastered), stability (REAL), difficulty (REAL), due (timestamp), elapsed_days, scheduled_days, learning_steps (JSONB), reps, lapses, last_review, first_seen_date, created_at, updated_at, unique constraint on (deck_id, vocabulary_id, user_id)

**srs_progress_logs**
- Review history log: id (UUID), user_id, vocabulary_id, srs_card_id, due, stability, difficulty, elapsed_days, scheduled_days, learning_steps (JSONB), reps, lapses, state, last_review, created_at

**user_chapter_progress_summary**
- Aggregated progress per chapter: id (UUID), user_id, series_id, chapter_id, cards_studied, total_cards, accuracy (REAL), time_spent_seconds, current_streak, completed (boolean), last_studied, first_studied, created_at, updated_at, unique constraint on (user_id, chapter_id)

**user_chapter_study_sessions**
- Study session records: id (UUID), user_id, chapter_id, deck_id, cards_studied, accuracy (REAL), time_spent_seconds, studied_at

**user_series_progress_summary**
- Aggregated progress per series: id (UUID), user_id, series_id, chapters_completed, total_chapters, cards_studied, total_cards, current_streak, last_studied, average_accuracy, total_time_spent_seconds, created_at, updated_at, unique constraint on (user_id, series_id)

### Database Features

**Access Control:**
- Profiles: users can view all, update only their own
- Series/chapters/vocabulary: public read access, admin write access
- User decks/SRS cards/progress: users can only access their own data

**Performance:**
- Indexes on foreign keys and frequently queried columns
- Composite indexes for common query patterns

**Data Integrity:**
- Unique constraints prevent duplicates (series slug, chapter number per series, vocabulary per chapter)
- Foreign key constraints ensure referential integrity
- Appropriate NOT NULL constraints

---

## UI/UX Requirements

### Design Principles
- Clean, modern interface
- Responsive design (mobile, tablet, desktop)
- Dark mode support
- Smooth animations and transitions (60fps)
- Loading states and error handling throughout
- Accessibility considerations (keyboard navigation, screen reader support)

### Key Pages

**Browse Page**
- Grid/list view of all series
- Search and filter controls
- Series cards with images and metadata
- Progress indicators for authenticated users

**Series Detail Page**
- Series header with cover image, title, synopsis, genres
- List of chapters with progress indicators
- Series-level progress summary card
- Navigation to chapters

**Chapter Detail Page**
- Chapter navigation (previous/next)
- Vocabulary list with Korean term, English definition, example
- Statistics: total vocabulary, progress summary
- "Start Studying" button to begin study session
- Progress indicators for authenticated users

**Study Page**
- Full-screen flashcard interface
- Card flip animation
- Rating buttons (4 options with keyboard shortcuts)
- Progress bar
- Session statistics panel
- Completion screen with summary

**Profile Page**
- User profile information and avatar
- Study statistics dashboard
- Progress charts and analytics
- Settings: study preferences, theme, account management
- Guest conversion option (if guest user)

**Admin Page**
- Multi-step form for content creation
- Series search component
- Chapter number input with validation
- Image upload component (drag-and-drop)
- Processing status display
- Success/error messaging

### Navigation
- Top navigation bar with: Browse, Study, Profile, Admin (if admin), Login/Logout
- Mobile-responsive hamburger menu
- Breadcrumb navigation on detail pages
- Quick access to current study session

---

## Non-Functional Requirements

### Performance
- Page load times: < 2 seconds for initial load
- Study session: instant card transitions (optimistic UI), background updates
- Image processing: handle large images efficiently (tiling, parallel processing)
- Database queries: optimize with batching, indexes, efficient joins

### Scalability
- Support concurrent users studying different chapters
- Efficient database queries with proper indexing
- Session caching to reduce database load
- Image storage in cloud storage

### Security
- Authentication and authorization system
- User data isolation and access control
- Input validation on all user inputs
- Admin-only access for content creation endpoints
- Secure API key management

### Reliability
- Error handling throughout (graceful degradation)
- Retry logic for external API calls
- Data validation before database operations
- Transaction support for critical operations
- Logging for debugging and monitoring

### User Experience
- Optimistic UI for study sessions (instant feedback)
- Client-side storage for guest users
- Clear error messages
- Loading states for async operations
- Progress indicators for long-running operations

---

## Key Algorithms & Logic

### FSRS Algorithm Integration
- Implement FSRS-5 spaced repetition algorithm for card scheduling
- Card state transitions based on ratings
- Next review date calculation
- Stability and difficulty updates
- Learning steps management
- Interval preview calculation (show user when card will be reviewed next based on rating choice)

### Vocabulary Deduplication
- Use sense_key to distinguish homonyms (same term, different meanings)
- Normalize English definitions to merge synonyms (same meaning, different formatting)
- Prevent duplicate vocabulary entries in database
- Link vocabulary to chapters with importance scores

### Study Card Selection
- Retrieve mix of new cards (never studied) and due cards (ready for review)
- Limit new cards per session (configurable, default 5)
- Limit total cards per session (configurable, default 20)
- Prioritize due cards over new cards
- Filter by chapter and user

### Image Processing Pipeline
- Optional upscaling for better OCR accuracy
- Automatic tiling for large images
- Parallel OCR processing for tiles
- Text grouping by vertical proximity (speech bubbles)
- AI extraction of vocabulary with translations and importance scores
- Batch database insertion with deduplication

---

## Configuration Requirements

The application requires configuration for:
- Database connection
- Authentication service
- OCR service API key
- AI/NLP service API key for vocabulary extraction
- Optional: Image upscaling toggle
- Optional: Debug logging toggle
- Optional: Cache service connection

---

## Success Criteria

**Functional:**
- Users can browse series and chapters
- Users can study vocabulary with flashcard interface
- FSRS algorithm correctly schedules card reviews
- Admins can create new chapter content from images
- Progress tracking accurately reflects user activity
- Authentication and authorization work correctly

**Performance:**
- Study sessions have instant card transitions
- Pages load within 2 seconds
- Image processing completes within reasonable time (< 30 seconds for typical images)

**User Experience:**
- Intuitive navigation and clear UI
- Smooth animations and responsive interactions
- Clear error messages and loading states
- Works on mobile, tablet, and desktop

**Technical:**
- Proper error handling and validation
- Secure authentication and data access
- Efficient database queries
- Clean, maintainable code structure
