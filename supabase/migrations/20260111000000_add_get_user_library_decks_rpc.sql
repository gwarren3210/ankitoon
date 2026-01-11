-- Migration: Add get_user_library_decks RPC function
-- Purpose: Optimize library deck fetching from 5 queries to 1
-- This replaces the multi-query approach in src/lib/series/libraryData.ts

CREATE OR REPLACE FUNCTION get_user_library_decks(p_user_id UUID)
RETURNS TABLE (
  -- Chapter fields
  chapter_id UUID,
  chapter_number INTEGER,
  chapter_title TEXT,
  chapter_external_url TEXT,
  chapter_series_id UUID,
  chapter_created_at TIMESTAMP WITH TIME ZONE,

  -- Series fields (all columns for full type compatibility)
  series_id UUID,
  series_name TEXT,
  series_korean_name TEXT,
  series_alt_names TEXT[],
  series_slug TEXT,
  series_picture_url TEXT,
  series_synopsis TEXT,
  series_popularity INTEGER,
  series_genres TEXT[],
  series_authors TEXT[],
  series_num_chapters INTEGER,
  series_created_at TIMESTAMP WITH TIME ZONE,
  series_updated_at TIMESTAMP WITH TIME ZONE,

  -- Progress fields
  progress_id UUID,
  progress_accuracy REAL,
  progress_num_cards_studied INTEGER,
  progress_total_cards INTEGER,
  progress_unique_vocab_seen INTEGER,
  progress_completed BOOLEAN,
  progress_current_streak INTEGER,
  progress_time_spent_seconds INTEGER,
  progress_first_studied TIMESTAMP WITH TIME ZONE,
  progress_last_studied TIMESTAMP WITH TIME ZONE,

  -- Calculated due counts
  due_now INTEGER,
  due_later_today INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_end_of_today TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calculate end of today in UTC
  v_end_of_today := DATE_TRUNC('day', v_now) + INTERVAL '1 day' - INTERVAL '1 millisecond';

  RETURN QUERY
  WITH user_progress AS (
    -- Get all chapters user has progress on
    SELECT *
    FROM user_chapter_progress_summary ucps
    WHERE ucps.user_id = p_user_id
  ),
  chapter_deck_cards AS (
    -- Get due card counts per chapter
    SELECT
      ucd.chapter_id,
      COUNT(*) FILTER (
        WHERE srs.due <= v_now AND srs.state != 'New'
      ) AS due_now,
      COUNT(*) FILTER (
        WHERE srs.due > v_now
          AND srs.due <= v_end_of_today
          AND srs.state != 'New'
      ) AS due_later_today
    FROM user_chapter_decks ucd
    JOIN user_deck_srs_cards srs ON srs.deck_id = ucd.id
    WHERE ucd.user_id = p_user_id
      AND ucd.chapter_id IS NOT NULL
      AND srs.due IS NOT NULL
    GROUP BY ucd.chapter_id
  )
  SELECT
    -- Chapter
    c.id,
    c.chapter_number,
    c.title,
    c.external_url,
    c.series_id,
    c.created_at,
    -- Series (all fields)
    s.id,
    s.name,
    s.korean_name,
    s.alt_names,
    s.slug,
    s.picture_url,
    s.synopsis,
    s.popularity,
    s.genres,
    s.authors,
    s.num_chapters,
    s.created_at,
    s.updated_at,
    -- Progress
    up.id,
    up.accuracy,
    up.num_cards_studied,
    up.total_cards,
    up.unique_vocab_seen,
    up.completed,
    up.current_streak,
    up.time_spent_seconds,
    up.first_studied,
    up.last_studied,
    -- Due counts (coalesce to 0 if no cards)
    COALESCE(cdc.due_now, 0)::INTEGER,
    COALESCE(cdc.due_later_today, 0)::INTEGER
  FROM user_progress up
  JOIN chapters c ON c.id = up.chapter_id
  JOIN series s ON s.id = up.series_id
  LEFT JOIN chapter_deck_cards cdc ON cdc.chapter_id = up.chapter_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_library_decks(UUID) TO authenticated;
