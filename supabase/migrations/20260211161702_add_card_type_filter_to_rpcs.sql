-- Migration: Add card type filter to get_study_cards and get_learn_cards RPCs
-- Purpose: Allows filtering by 'vocabulary' or 'grammar' when fetching cards
-- Default behavior (NULL) returns both types (backwards compatible)

-- ============================================================================
-- STEP 1: UPDATE get_study_cards RPC WITH OPTIONAL CARD TYPE FILTER
-- ============================================================================

DROP FUNCTION IF EXISTS get_study_cards(UUID, UUID);

CREATE OR REPLACE FUNCTION get_study_cards(
  p_user_id UUID,
  p_chapter_id UUID,
  p_card_type card_type DEFAULT NULL  -- NEW: optional filter
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
  -- Filters by card type if p_card_type is specified
  RETURN QUERY
  WITH all_chapter_cards AS (
    -- Vocabulary cards (included when p_card_type IS NULL or 'vocabulary')
    SELECT
      srs.id AS srs_card_id,
      'vocabulary'::card_type AS card_type,
      v.id AS vocabulary_id,
      v.term,
      v.definition,
      v.example,
      cv.example AS chapter_example,
      v.sense_key,
      v.created_at AS vocabulary_created_at,
      NULL::UUID AS grammar_id,
      NULL::TEXT AS pattern,
      NULL::TEXT AS grammar_definition,
      NULL::TEXT AS grammar_example,
      NULL::TEXT AS grammar_chapter_example,
      NULL::TEXT AS grammar_sense_key,
      NULL::TIMESTAMP WITH TIME ZONE AS grammar_created_at,
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
      AND (p_card_type IS NULL OR p_card_type = 'vocabulary')

    UNION ALL

    -- Grammar cards (included when p_card_type IS NULL or 'grammar')
    SELECT
      srs.id AS srs_card_id,
      'grammar'::card_type AS card_type,
      NULL::UUID AS vocabulary_id,
      NULL::TEXT AS term,
      NULL::TEXT AS definition,
      NULL::TEXT AS example,
      NULL::TEXT AS chapter_example,
      NULL::TEXT AS sense_key,
      NULL::TIMESTAMP WITH TIME ZONE AS vocabulary_created_at,
      g.id AS grammar_id,
      g.pattern,
      g.definition AS grammar_definition,
      g.example AS grammar_example,
      cg.example AS grammar_chapter_example,
      g.sense_key AS grammar_sense_key,
      g.created_at AS grammar_created_at,
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
      AND (p_card_type IS NULL OR p_card_type = 'grammar')
  ),
  new_cards AS (
    SELECT * FROM all_chapter_cards
    WHERE state = 'New'::srs_state
    ORDER BY srs_created_at ASC
    LIMIT v_max_new_cards
  ),
  due_cards AS (
    SELECT * FROM all_chapter_cards
    WHERE due <= v_now
      AND state != 'New'::srs_state
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
GRANT EXECUTE ON FUNCTION get_study_cards(UUID, UUID, card_type) TO authenticated;

COMMENT ON FUNCTION get_study_cards IS
  'Retrieves study cards (vocabulary and/or grammar) for a chapter. '
  'Optional p_card_type parameter filters by vocabulary or grammar. '
  'NULL (default) returns both types for backwards compatibility.';

-- ============================================================================
-- STEP 2: UPDATE get_learn_cards RPC WITH OPTIONAL CARD TYPE FILTER
-- ============================================================================

DROP FUNCTION IF EXISTS get_learn_cards(UUID, UUID);

CREATE OR REPLACE FUNCTION get_learn_cards(
  p_user_id UUID,
  p_chapter_id UUID,
  p_card_type card_type DEFAULT NULL  -- NEW: optional filter
)
RETURNS TABLE (
  -- Card metadata
  srs_card_id UUID,
  deck_id UUID,
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
  card_state srs_state,
  difficulty REAL
) AS $$
DECLARE
  v_deck_id UUID;
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

  -- Return only NEW cards, filtered by card type if specified
  RETURN QUERY
  -- Vocabulary cards (included when p_card_type IS NULL or 'vocabulary')
  SELECT
    srs.id AS srs_card_id,
    srs.deck_id,
    'vocabulary'::card_type AS card_type,
    v.id AS vocabulary_id,
    v.term,
    v.definition,
    v.example,
    cv.example AS chapter_example,
    v.sense_key,
    v.created_at AS vocabulary_created_at,
    NULL::UUID AS grammar_id,
    NULL::TEXT AS pattern,
    NULL::TEXT AS grammar_definition,
    NULL::TEXT AS grammar_example,
    NULL::TEXT AS grammar_chapter_example,
    NULL::TEXT AS grammar_sense_key,
    NULL::TIMESTAMP WITH TIME ZONE AS grammar_created_at,
    srs.state AS card_state,
    srs.difficulty
  FROM user_deck_srs_cards srs
  INNER JOIN vocabulary v ON v.id = srs.vocabulary_id
  INNER JOIN chapter_vocabulary cv ON cv.vocabulary_id = v.id
  WHERE srs.user_id = p_user_id
    AND srs.deck_id = v_deck_id
    AND srs.state = 'New'::srs_state
    AND srs.card_type = 'vocabulary'
    AND cv.chapter_id = p_chapter_id
    AND (p_card_type IS NULL OR p_card_type = 'vocabulary')

  UNION ALL

  -- Grammar cards (included when p_card_type IS NULL or 'grammar')
  SELECT
    srs.id AS srs_card_id,
    srs.deck_id,
    'grammar'::card_type AS card_type,
    NULL::UUID AS vocabulary_id,
    NULL::TEXT AS term,
    NULL::TEXT AS definition,
    NULL::TEXT AS example,
    NULL::TEXT AS chapter_example,
    NULL::TEXT AS sense_key,
    NULL::TIMESTAMP WITH TIME ZONE AS vocabulary_created_at,
    g.id AS grammar_id,
    g.pattern,
    g.definition AS grammar_definition,
    g.example AS grammar_example,
    cg.example AS grammar_chapter_example,
    g.sense_key AS grammar_sense_key,
    g.created_at AS grammar_created_at,
    srs.state AS card_state,
    srs.difficulty
  FROM user_deck_srs_cards srs
  INNER JOIN grammar g ON g.id = srs.grammar_id
  INNER JOIN chapter_grammar cg ON cg.grammar_id = g.id
  WHERE srs.user_id = p_user_id
    AND srs.deck_id = v_deck_id
    AND srs.state = 'New'::srs_state
    AND srs.card_type = 'grammar'
    AND cg.chapter_id = p_chapter_id
    AND (p_card_type IS NULL OR p_card_type = 'grammar')

  ORDER BY srs_card_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_learn_cards(UUID, UUID, card_type) TO authenticated;

COMMENT ON FUNCTION get_learn_cards IS
  'Retrieves NEW cards (vocabulary and/or grammar) for a chapter learn session. '
  'Optional p_card_type parameter filters by vocabulary or grammar. '
  'NULL (default) returns both types for backwards compatibility.';
