-- Migration: Fix ambiguous 'state' column reference in get_study_cards RPC
-- Issue: Column 'state' is ambiguous between RETURNS TABLE parameter and CTE column
-- Fix: Qualify all state references with table/CTE aliases

DROP FUNCTION IF EXISTS get_study_cards(UUID, UUID);

CREATE OR REPLACE FUNCTION get_study_cards(
  p_user_id UUID,
  p_chapter_id UUID
)
RETURNS TABLE (
  -- Card metadata
  srs_card_id UUID,
  card_type card_type,
  -- Vocabulary fields (NULL for grammar cards)
  vocabulary_id UUID,
  term TEXT,
  definition TEXT,
  example TEXT,
  chapter_example TEXT,
  sense_key TEXT,
  vocabulary_created_at TIMESTAMP WITH TIME ZONE,
  -- Grammar fields (NULL for vocabulary cards)
  grammar_id UUID,
  pattern TEXT,
  grammar_definition TEXT,
  grammar_example TEXT,
  grammar_chapter_example TEXT,
  grammar_sense_key TEXT,
  grammar_created_at TIMESTAMP WITH TIME ZONE,
  -- SRS fields
  state srs_state,
  stability REAL,
  difficulty REAL,
  total_reviews INTEGER,
  streak_incorrect INTEGER,
  due TIMESTAMP WITH TIME ZONE,
  last_reviewed_date TIMESTAMP WITH TIME ZONE,
  first_seen_date TIMESTAMP WITH TIME ZONE,
  scheduled_days INTEGER,
  learning_steps INTEGER
) AS $$
DECLARE
  v_deck_id UUID;
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_max_new_cards INTEGER;
  v_max_total_cards INTEGER;
BEGIN
  -- Get deck ID for this chapter
  SELECT id
  INTO v_deck_id
  FROM user_chapter_decks
  WHERE user_id = p_user_id
    AND chapter_id = p_chapter_id;

  -- Return empty if no deck found
  IF v_deck_id IS NULL THEN
    RETURN;
  END IF;

  -- Get max_new_cards and max_total_cards from profile, use defaults if NULL
  SELECT
    COALESCE(max_new_cards, 10),
    COALESCE(max_total_cards, 30)
  INTO v_max_new_cards, v_max_total_cards
  FROM profiles
  WHERE id = p_user_id;

  -- Return new cards first (up to max_new_cards), then due cards
  -- Combines both vocabulary and grammar cards
  RETURN QUERY
  WITH all_chapter_cards AS (
    -- Vocabulary cards
    SELECT
      srs.id AS srs_card_id,
      'vocabulary'::card_type AS card_type,
      -- Vocabulary fields
      v.id AS vocabulary_id,
      v.term,
      v.definition,
      v.example,
      cv.example AS chapter_example,
      v.sense_key,
      v.created_at AS vocabulary_created_at,
      -- Grammar fields (NULL for vocabulary)
      NULL::UUID AS grammar_id,
      NULL::TEXT AS pattern,
      NULL::TEXT AS grammar_definition,
      NULL::TEXT AS grammar_example,
      NULL::TEXT AS grammar_chapter_example,
      NULL::TEXT AS grammar_sense_key,
      NULL::TIMESTAMP WITH TIME ZONE AS grammar_created_at,
      -- SRS fields
      srs.state,
      srs.stability,
      srs.difficulty,
      srs.total_reviews,
      srs.streak_incorrect,
      srs.due,
      srs.last_reviewed_date,
      srs.first_seen_date,
      srs.scheduled_days,
      srs.learning_steps,
      srs.created_at AS srs_created_at
    FROM user_deck_srs_cards srs
    INNER JOIN vocabulary v ON v.id = srs.vocabulary_id
    INNER JOIN chapter_vocabulary cv ON cv.vocabulary_id = srs.vocabulary_id
    WHERE srs.user_id = p_user_id
      AND srs.deck_id = v_deck_id
      AND srs.card_type = 'vocabulary'
      AND cv.chapter_id = p_chapter_id
      AND (srs.state = 'New'::srs_state OR srs.due <= v_now)

    UNION ALL

    -- Grammar cards
    SELECT
      srs.id AS srs_card_id,
      'grammar'::card_type AS card_type,
      -- Vocabulary fields (NULL for grammar)
      NULL::UUID AS vocabulary_id,
      NULL::TEXT AS term,
      NULL::TEXT AS definition,
      NULL::TEXT AS example,
      NULL::TEXT AS chapter_example,
      NULL::TEXT AS sense_key,
      NULL::TIMESTAMP WITH TIME ZONE AS vocabulary_created_at,
      -- Grammar fields
      g.id AS grammar_id,
      g.pattern,
      g.definition AS grammar_definition,
      g.example AS grammar_example,
      cg.example AS grammar_chapter_example,
      g.sense_key AS grammar_sense_key,
      g.created_at AS grammar_created_at,
      -- SRS fields
      srs.state,
      srs.stability,
      srs.difficulty,
      srs.total_reviews,
      srs.streak_incorrect,
      srs.due,
      srs.last_reviewed_date,
      srs.first_seen_date,
      srs.scheduled_days,
      srs.learning_steps,
      srs.created_at AS srs_created_at
    FROM user_deck_srs_cards srs
    INNER JOIN grammar g ON g.id = srs.grammar_id
    INNER JOIN chapter_grammar cg ON cg.grammar_id = srs.grammar_id
    WHERE srs.user_id = p_user_id
      AND srs.deck_id = v_deck_id
      AND srs.card_type = 'grammar'
      AND cg.chapter_id = p_chapter_id
      AND (srs.state = 'New'::srs_state OR srs.due <= v_now)
  ),
  new_cards AS (
    SELECT * FROM all_chapter_cards
    WHERE all_chapter_cards.state = 'New'::srs_state
    ORDER BY srs_created_at ASC
    LIMIT v_max_new_cards
  ),
  due_cards AS (
    SELECT * FROM all_chapter_cards
    WHERE all_chapter_cards.due <= v_now
      AND all_chapter_cards.state != 'New'::srs_state
    ORDER BY due ASC
  )
  SELECT
    combined.srs_card_id,
    combined.card_type,
    combined.vocabulary_id,
    combined.term,
    combined.definition,
    combined.example,
    combined.chapter_example,
    combined.sense_key,
    combined.vocabulary_created_at,
    combined.grammar_id,
    combined.pattern,
    combined.grammar_definition,
    combined.grammar_example,
    combined.grammar_chapter_example,
    combined.grammar_sense_key,
    combined.grammar_created_at,
    combined.state,
    combined.stability,
    combined.difficulty,
    combined.total_reviews,
    combined.streak_incorrect,
    combined.due,
    combined.last_reviewed_date,
    combined.first_seen_date,
    combined.scheduled_days,
    combined.learning_steps
  FROM (
    SELECT * FROM new_cards
    UNION ALL
    SELECT * FROM due_cards
  ) combined
  ORDER BY
    CASE WHEN combined.state = 'New'::srs_state THEN 0 ELSE 1 END,
    combined.due ASC
  LIMIT v_max_total_cards;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_study_cards(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION get_study_cards IS
  'Retrieves study cards (vocabulary and grammar) for a chapter. '
  'Returns new cards first (up to max_new_cards limit), then due cards. '
  'Respects user profile settings for max_new_cards and max_total_cards.';
