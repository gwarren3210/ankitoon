-- Update get_study_cards RPC function to use stability and difficulty
-- Must run after migration 20251225175843_migrate_to_stability_difficulty.sql

-- Drop existing function first since return type is changing
DROP FUNCTION IF EXISTS get_study_cards(UUID, UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_study_cards(
  p_user_id UUID,
  p_chapter_id UUID,
  p_max_new_cards INTEGER,
  p_max_total_cards INTEGER
)
RETURNS TABLE (
  vocabulary_id UUID,
  term TEXT,
  definition TEXT,
  example TEXT,
  sense_key TEXT,
  srs_card_id UUID,
  state srs_state,
  stability REAL,
  difficulty REAL,
  total_reviews INTEGER,
  streak_incorrect INTEGER,
  next_review_date TIMESTAMP WITH TIME ZONE,
  last_reviewed_date TIMESTAMP WITH TIME ZONE,
  first_seen_date TIMESTAMP WITH TIME ZONE,
  elapsed_days INTEGER,
  is_new BOOLEAN
) AS $$
DECLARE
  v_deck_id UUID;
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_new_count INTEGER;
  v_remaining_slots INTEGER;
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

  -- Count new cards (state = 'New') for this chapter
  SELECT COUNT(*)
  INTO v_new_count
  FROM user_deck_srs_cards srs
  INNER JOIN chapter_vocabulary cv ON cv.vocabulary_id = srs.vocabulary_id
  WHERE srs.user_id = p_user_id
    AND srs.deck_id = v_deck_id
    AND cv.chapter_id = p_chapter_id
    AND srs.state = 'New'::srs_state;

  -- Limit new cards count to max_new_cards
  v_new_count := LEAST(v_new_count, p_max_new_cards);

  -- Calculate remaining slots for due cards
  v_remaining_slots := p_max_total_cards - v_new_count;
  v_remaining_slots := GREATEST(v_remaining_slots, 0);

  -- Return new cards first (up to max_new_cards), then due cards to fill remaining slots
  -- Single query with base CTE for join, then filter CTEs
  RETURN QUERY
  WITH chapter_cards AS (
    SELECT
      v.id AS vocabulary_id,
      v.term,
      v.definition,
      v.example,
      v.sense_key,
      srs.id AS srs_card_id,
      srs.state,
      srs.stability,
      srs.difficulty,
      srs.total_reviews,
      srs.streak_incorrect,
      srs.next_review_date,
      srs.last_reviewed_date,
      srs.first_seen_date,
      COALESCE(
        EXTRACT(DAY FROM (v_now - srs.last_reviewed_date))::INTEGER,
        0
      ) AS elapsed_days,
      srs.created_at
    FROM user_deck_srs_cards srs
    INNER JOIN vocabulary v ON v.id = srs.vocabulary_id
    INNER JOIN chapter_vocabulary cv ON cv.vocabulary_id = srs.vocabulary_id
    WHERE srs.user_id = p_user_id
      AND srs.deck_id = v_deck_id
      AND cv.chapter_id = p_chapter_id
  ),
  new_cards AS (
    SELECT
      vocabulary_id,
      term,
      definition,
      example,
      sense_key,
      srs_card_id,
      state,
      stability,
      difficulty,
      total_reviews,
      streak_incorrect,
      next_review_date,
      last_reviewed_date,
      first_seen_date,
      elapsed_days
    FROM chapter_cards
    WHERE state = 'New'::srs_state
    ORDER BY created_at ASC
    LIMIT p_max_new_cards
  ),
  due_cards AS (
    SELECT
      vocabulary_id,
      term,
      definition,
      example,
      sense_key,
      srs_card_id,
      state,
      stability,
      difficulty,
      total_reviews,
      streak_incorrect,
      next_review_date,
      last_reviewed_date,
      first_seen_date,
      elapsed_days
    FROM chapter_cards
    WHERE next_review_date <= v_now
      AND state != 'New'::srs_state
    ORDER BY next_review_date ASC
    LIMIT v_remaining_slots
  )
  SELECT
    vocabulary_id,
    term,
    definition,
    example,
    sense_key,
    srs_card_id,
    state,
    stability,
    difficulty,
    total_reviews,
    streak_incorrect,
    next_review_date,
    last_reviewed_date,
    first_seen_date,
    elapsed_days,
    (state = 'New'::srs_state) AS is_new
  FROM (
    SELECT * FROM new_cards
    UNION ALL
    SELECT * FROM due_cards
  ) combined_cards
  ORDER BY next_review_date ASC
  LIMIT p_max_total_cards;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_study_cards(UUID, UUID, INTEGER, INTEGER) TO authenticated;

