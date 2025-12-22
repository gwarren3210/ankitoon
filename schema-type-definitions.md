# AnkiToon Schema & Type Definitions

## Table of Contents

### Database Schema
- [Core Tables](#core-tables)
  - [series](#series)
  - [chapters](#chapters)
  - [vocabulary](#vocabulary)
  - [chapter_vocabulary](#chapter_vocabulary-join-table)
  - [user_chapter_decks](#user_chapter_decks)
  - [user_deck_srs_cards](#user_deck_srs_cards-srs-tracking---sm-2-style)
  - [srs_progress_logs](#srs_progress_log-alternative-fsrs-tracking)
  - [user_chapter_progress_summary](#user_chapter_progress_summary)
  - [user_chapter_study_sessions](#user_chapter_study_sessions)
  - [user_series_progress_summary](#user_series_progress_summary)
- [Row Level Security (RLS) Policies](#row-level-security-rls-policies)

### TypeScript Type Definitions
- [Database Types](#enhanced-typescript-types-for-nextjs)
- [Core Entities](#core-entities)
  - [Series](#series-type)
  - [Chapter](#chapter-type)
  - [Vocabulary](#vocabulary-type)
  - [UserChapterDeck](#userchapterdeck-type)
- [SRS Types](#srs-types)
  - [FsrsState](#fsrsstate-enum)
  - [ChapterFsrsCard](#chapterfsrscard-type)
  - [FsrsRating](#fsrsrating-enum)
  - [FsrsProgress](#fsrsprogress-type)
- [Study Session Types](#study-session-types)
- [Progress Tracking Types](#progress-tracking-types)
- [API Response Types](#api-response-types)
- [Deck Creation Types](#deck-creation-types)
- [Filter Types](#filter-types)

---

## Database Schema

### Core Tables

#### series

```sql
CREATE TABLE series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  korean_name TEXT,
  alt_names TEXT[],
  slug TEXT UNIQUE NOT NULL,
  picture_url TEXT,
  synopsis TEXT,
  popularity INTEGER,
  genres TEXT[],
  authors TEXT[],
  num_chapters INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_series_slug ON series(slug);
CREATE INDEX idx_series_popularity ON series(popularity DESC);
```

#### chapters

```sql
CREATE TABLE chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (series_id, chapter_number)
);

CREATE INDEX idx_chapters_series_id ON chapters(series_id);
```

#### vocabulary

```sql
CREATE TABLE vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  example TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_vocabulary_term ON vocabulary(term);
```

#### chapter_vocabulary (join table)

```sql
CREATE TABLE chapter_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  vocabulary_id UUID NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  importance_score INTEGER DEFAULT 0,
  UNIQUE (chapter_id, vocabulary_id)
);

CREATE INDEX idx_chapter_vocab_word ON chapter_vocabulary(vocabulary_id);
CREATE INDEX idx_chapter_vocabulary_chapter_id ON chapter_vocabulary(chapter_id);
```

#### user_chapter_decks

```sql
CREATE TABLE user_chapter_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_chapter_decks_user_id ON user_chapter_decks(user_id);
CREATE INDEX idx_user_chapter_decks_chapter_id ON user_chapter_decks(chapter_id);
```

#### user_deck_srs_cards (SRS tracking - SM-2 style)

```sql
CREATE TYPE srs_state AS ENUM ('new', 'learning', 'reviewing', 'mastered');

CREATE TABLE user_deck_srs_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES user_chapter_decks(id) ON DELETE CASCADE,
  vocabulary_id UUID NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- SRS/SM-2 fields
  state srs_state NOT NULL DEFAULT 'new',
  review_interval_days INTEGER NOT NULL DEFAULT 0,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  streak_correct INTEGER NOT NULL DEFAULT 0,
  streak_incorrect INTEGER NOT NULL DEFAULT 0,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  next_review_date TIMESTAMP WITH TIME ZONE,
  last_reviewed_date TIMESTAMP WITH TIME ZONE,
  first_seen_date TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE (deck_id, vocabulary_id, user_id)
);

CREATE INDEX idx_user_deck_srs_cards_deck_id ON user_deck_srs_cards(deck_id);
CREATE INDEX idx_user_deck_srs_cards_user_id ON user_deck_srs_cards(user_id);
CREATE INDEX idx_user_deck_srs_cards_next_review ON user_deck_srs_cards(user_id, next_review_date)
  WHERE next_review_date IS NOT NULL;
```

#### srs_progress_log (Alternative FSRS tracking)

```sql
CREATE TABLE srs_progress_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  vocabulary_id UUID NOT NULL REFERENCES vocabulary(id),
  srs_card_id UUID REFERENCES user_deck_srs_cards(id),
  
  -- FSRS fields
  due TIMESTAMP WITH TIME ZONE NOT NULL,
  stability REAL NOT NULL,
  difficulty REAL NOT NULL,
  elapsed_days INTEGER NOT NULL DEFAULT 0,
  scheduled_days INTEGER NOT NULL DEFAULT 0,
  learning_steps JSONB,
  reps INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  state srs_state NOT NULL DEFAULT 'new',
  last_review TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
);

CREATE INDEX idx_srs_progress_logs_user_id ON srs_progress_logs(user_id)
```

#### user_chapter_progress_summary

```sql
CREATE TABLE user_chapter_progress_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  
  cards_studied INTEGER DEFAULT 0,
  total_cards INTEGER DEFAULT 0,
  accuracy REAL DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  last_studied TIMESTAMP,
  first_studied TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE (user_id, chapter_id)
);

-- Indexes for fast lookup
CREATE INDEX idx_ucps_user ON user_chapter_progress_summary(user_id);
CREATE INDEX idx_ucps_chapter ON user_chapter_progress_summary(chapter_id);
CREATE INDEX idx_ucps_user_series ON user_chapter_progress_summary(user_id, series_id);
```

#### user_chapter_study_sessions

```sql
CREATE TABLE user_chapter_study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  deck_id UUID REFERENCES user_chapter_decks(id), -- optional
  cards_studied INTEGER NOT NULL,
  accuracy REAL NOT NULL,
  time_spent_seconds INTEGER NOT NULL,
  studied_at TIMESTAMP NOT NULL DEFAULT NOW(),
);

CREATE INDEX idx_ucss_user_chapter ON user_chapter_study_sessions(user_id, chapter_id);
CREATE INDEX idx_ucss_studied_at ON user_chapter_study_sessions(studied_at DESC);
```

#### user_series_progress_summary

```sql
CREATE TABLE user_series_progress_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  
  chapters_completed INTEGER DEFAULT 0,
  total_chapters INTEGER DEFAULT 0,
  cards_studied INTEGER DEFAULT 0,
  total_cards INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  last_studied TIMESTAMP,
  average_accuracy REAL DEFAULT 0,
  total_time_spent_seconds INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, series_id)
);

CREATE INDEX idx_user_series_progress_user ON user_series_progress_summary(user_id);
CREATE INDEX idx_user_series_progress_series ON user_series_progress_summary(series_id);
```

### Row Level Security (RLS) Policies

```sql
-- Users can only see their own decks
ALTER TABLE user_chapter_decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own decks"
  ON user_chapter_decks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own decks"
  ON user_chapter_decks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own progress
ALTER TABLE user_deck_srs_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own srs cards"
  ON user_deck_srs_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own srs cards"
  ON user_deck_srs_cards FOR UPDATE
  USING (auth.uid() = user_id);

ALTER TABLE srs_progress_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress logs"
  ON srs_progress_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress logs"
  ON srs_progress_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Similar policies for other user-specific tables
```

---

## Type Definitions

### Enhanced TypeScript Types for Next.js

#### Database Types

```typescript
// Database types
export type Database = {
  public: {
    Tables: {
      series: {
        Row: Series
        Insert: Omit<Series, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Series>
      }
      // ... other tables
    }
  }
}
```

#### Core Entities

##### Series Type

```typescript
export interface Series {
  id: string
  name: string
  koreanName: string
  altNames: string[]
  slug: string
  pictureUrl: string
  synopsis: string
  popularity: number | null
  genres: string[]
  authors: string[]
  numChapters: number
  createdAt: string
  updatedAt: string
}
```

##### Chapter Type

```typescript
export interface Chapter {
  id: string
  seriesId: string
  chapterNumber: number
  title: string
}
```

##### Vocabulary Type

```typescript
export interface Vocabulary {
  id: string
  chapterId: string
  vocabulary: string
  definition: string
  example: string
  importanceScore: number
}
```

##### UserChapterDeck Type

```typescript
export interface UserChapterDeck {
  id: string
  chapterId: string
  seriesTitle: string
  seriesId: string
  chapterNumber: number
  userId: string
  word_count?: number // Computed
  created_at: string
  updated_at: string
}
```

#### SRS Types

##### FsrsState Enum

```typescript
export enum FsrsState {
  New = 'new',
  Learning = 'learning',
  Reviewing = 'reviewing',
  Mastered = 'mastered',
}
```

##### ChapterFsrsCard Type

```typescript
export interface ChapterFsrsCard {
  id: string
  chapterId: string
  deckId: string
  vocabularyId: string
  userId: string

  state: FsrsState
  interval: number
  easeFactor: number
  streakCorrect: number
  streakIncorrect: number
  totalReviews: number
  nextReviewDate: string | null
  lastReviewedDate: string | null
  firstSeenDate: string | null
  createdAt: string
  updatedAt: string

  vocabulary: string
  definition: string
  example: string
  importanceScore: number
}
```

##### FsrsRating Enum

```typescript
export enum FsrsRating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

export const FsrsRatingLabels: Record<FsrsRating, string> = {
  [FSRSRating.Again]: 'Again',
  [FSRSRating.Hard]: 'Hard',
  [FSRSRating.Good]: 'Good',
  [FSRSRating.Easy]: 'Easy',
}
```

##### FsrsProgress Type

```typescript
export interface FsrsProgress {
  id: string
  user_id: string
  vocabulary_id: string
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number[] | null
  reps: number
  lapses: number
  state: FsrsState
  last_review: string | null
  created_at: string
  updated_at: string
}
```

#### Study Session Types

```typescript
export interface C {
  id: string
  vocabulary: string
  definition: string

  example: string | null
  state: FsrsState
  nextReviewDate: Date | null
  progress: FsrsProgress
}

export interface StudySession {
  sessionId: string
  deckId: string
  userId: string
  queue: StudyCard[]
  current_card: StudyCard | null
  progress: SessionProgress
}

export interface SessionProgress {
  reviewed: number
  grades: FSRSRating[]
  startTime: Date
  duration: number // seconds
}
```

#### Progress Tracking Types

```typescript
export interface UserChapterProgress {
  id: string
  userId: string
  seriesId: string
  chapterId: string
  cardsStudied: number
  totalCards: number
  accuracy: number
  timeSpent: number
  lastStudied: string | null
  streak: number
  isCompleted: boolean
  createdAt: string
  updatedAt: string
}

export interface UserSeriesProgress {
  id: string
  userId: string
  seriesId: string
  chaptersCompleted: number
  totalChapters: number
  cardsStudied: number
  totalCards: number
  currentStreak: number
  lastStudied: string | null
  averageAccuracy: number
  totalTimeSpent: number
  createdAt: string
  updatedAt: string
}

export interface UserStats {
  totalWords: number
  wordsMastered: number
  wordsLearning: number
  wordsNew: number
  currentStreak: number
  longestStreak: number
  totalStudyTime: number // seconds
  averageAccuracy: number
  cardsDueToday: number
  recentSeries: Series[]
  recent_activity: StudyActivity[]
}

export interface StudyActivity {
  date: string
  cardsReviewed: number
  timeSpent: number
  averageRating: number
}
```

#### API Response Types

```typescript
export interface ApiResponse<T> {
  data: T
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    per_page: number
    total: number
    total_pages: number
  }
}
```

#### Deck Creation Types

```typescript
export interface OCRResult {
  text: string
  confidence: number
  bounding_box: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface TranslationResult {
  original: string
  translated: string
  confidence: number
}

export interface DeckCreationData {
  image_url: string
  ocr_results: OCRResult[]
  translations: TranslationResult[]
  selected_words: string[]
  deck_name: string
  chapter_id?: string
}
```

#### Filter Types

```typescript
export interface DeckFilters {
  series_id?: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  genre?: string
  search?: string
  sort_by?: 'popularity' | 'created_at' | 'word_count'
  page?: number
  per_page?: number
}
```