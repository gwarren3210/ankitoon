-- Initial schema for AnkiToon
-- Creates all core tables, indexes, and RLS policies

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE srs_state AS ENUM ('new', 'learning', 'reviewing', 'mastered');

-- ============================================================================
-- USER PROFILE TABLE
-- ============================================================================

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username TEXT UNIQUE,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_profiles_username ON profiles(username);

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Series table
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
  num_chapters INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_series_slug ON series(slug);
CREATE INDEX idx_series_popularity ON series(popularity DESC);

-- Chapters table
CREATE TABLE chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (series_id, chapter_number)
);

CREATE INDEX idx_chapters_series_id ON chapters(series_id);

-- Vocabulary table
CREATE TABLE vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  example TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_vocabulary_term ON vocabulary(term);

-- Chapter vocabulary join table
CREATE TABLE chapter_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  vocabulary_id UUID NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  importance_score INTEGER DEFAULT 0,
  UNIQUE (chapter_id, vocabulary_id)
);

CREATE INDEX idx_chapter_vocab_word ON chapter_vocabulary(vocabulary_id);
CREATE INDEX idx_chapter_vocabulary_chapter_id ON chapter_vocabulary(chapter_id);

-- ============================================================================
-- USER DECK TABLES
-- ============================================================================

-- User chapter decks
CREATE TABLE user_chapter_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_chapter_decks_user_id ON user_chapter_decks(user_id);
CREATE INDEX idx_user_chapter_decks_chapter_id ON user_chapter_decks(chapter_id);

-- User deck SRS cards (SM-2 style tracking)
CREATE TABLE user_deck_srs_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES user_chapter_decks(id) ON DELETE CASCADE,
  vocabulary_id UUID NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
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

-- SRS progress logs (Alternative FSRS tracking)
CREATE TABLE srs_progress_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
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
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_srs_progress_logs_user_id ON srs_progress_logs(user_id);

-- ============================================================================
-- PROGRESS TRACKING TABLES
-- ============================================================================

-- User chapter progress summary
CREATE TABLE user_chapter_progress_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  
  cards_studied INTEGER DEFAULT 0,
  total_cards INTEGER DEFAULT 0,
  accuracy REAL DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  last_studied TIMESTAMP WITH TIME ZONE,
  first_studied TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE (user_id, chapter_id)
);

CREATE INDEX idx_ucps_user ON user_chapter_progress_summary(user_id);
CREATE INDEX idx_ucps_chapter ON user_chapter_progress_summary(chapter_id);
CREATE INDEX idx_ucps_user_series ON user_chapter_progress_summary(user_id, series_id);

-- User chapter study sessions
CREATE TABLE user_chapter_study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  deck_id UUID REFERENCES user_chapter_decks(id),
  cards_studied INTEGER NOT NULL,
  accuracy REAL NOT NULL,
  time_spent_seconds INTEGER NOT NULL,
  studied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ucss_user_chapter ON user_chapter_study_sessions(user_id, chapter_id);
CREATE INDEX idx_ucss_studied_at ON user_chapter_study_sessions(studied_at DESC);

-- User series progress summary
CREATE TABLE user_series_progress_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  
  chapters_completed INTEGER DEFAULT 0,
  total_chapters INTEGER DEFAULT 0,
  cards_studied INTEGER DEFAULT 0,
  total_cards INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  last_studied TIMESTAMP WITH TIME ZONE,
  average_accuracy REAL DEFAULT 0,
  total_time_spent_seconds INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, series_id)
);

CREATE INDEX idx_user_series_progress_user ON user_series_progress_summary(user_id);
CREATE INDEX idx_user_series_progress_series ON user_series_progress_summary(series_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Profiles: Users can view all profiles but only update their own
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Series are public (read-only for all users)
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Series are viewable by everyone"
  ON series FOR SELECT
  USING (true);

-- Chapters are public (read-only for all users)
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chapters are viewable by everyone"
  ON chapters FOR SELECT
  USING (true);

-- Vocabulary is viewable by authenticated users only
ALTER TABLE vocabulary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vocabulary is viewable by authenticated users"
  ON vocabulary FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Chapter vocabulary is viewable by authenticated users only
ALTER TABLE chapter_vocabulary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chapter vocabulary is viewable by authenticated users"
  ON chapter_vocabulary FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Users can only see their own decks
ALTER TABLE user_chapter_decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own decks"
  ON user_chapter_decks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own decks"
  ON user_chapter_decks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own decks"
  ON user_chapter_decks FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only manage their own SRS cards
ALTER TABLE user_deck_srs_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own srs cards"
  ON user_deck_srs_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own srs cards"
  ON user_deck_srs_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own srs cards"
  ON user_deck_srs_cards FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only manage their own progress logs
ALTER TABLE srs_progress_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress logs"
  ON srs_progress_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress logs"
  ON srs_progress_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only view their own progress summaries
ALTER TABLE user_chapter_progress_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chapter progress"
  ON user_chapter_progress_summary FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chapter progress"
  ON user_chapter_progress_summary FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chapter progress"
  ON user_chapter_progress_summary FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only view their own study sessions
ALTER TABLE user_chapter_study_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own study sessions"
  ON user_chapter_study_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own study sessions"
  ON user_chapter_study_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only view their own series progress
ALTER TABLE user_series_progress_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own series progress"
  ON user_series_progress_summary FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own series progress"
  ON user_series_progress_summary FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own series progress"
  ON user_series_progress_summary FOR UPDATE
  USING (auth.uid() = user_id);
