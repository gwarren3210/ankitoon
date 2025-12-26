-- Fix ambiguous vocabulary_id reference in get_study_cards RPC function
-- The issue is that both vocabulary and chapter_vocabulary tables have vocabulary_id
-- and it's referenced without proper qualification in some places

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
  id UUID,
  state srs_state,
  stability REAL,
  difficulty REAL,
  total_reviews INTEGER,
  streak_incorrect INTEGER,
  due TIMESTAMP,
  last_reviewed_date TIMESTAMP,
  first_seen_date TIMESTAMP
) AS $$
DECLARE
  v_deck_id UUID;
  v_now TIMESTAMP := NOW();
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
      srs.id AS id,
      srs.state,
      srs.stability,
      srs.difficulty,
      srs.total_reviews,
      srs.streak_incorrect,
      srs.due,
      srs.last_reviewed_date,
      srs.first_seen_date,
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
      cc.vocabulary_id,
      cc.term,
      cc.definition,
      cc.example,
      cc.sense_key,
      cc.id,
      cc.state,
      cc.stability,
      cc.difficulty,
      cc.total_reviews,
      cc.streak_incorrect,
      cc.due,
      cc.last_reviewed_date,
      cc.first_seen_date
    FROM chapter_cards cc
    WHERE cc.state = 'New'::srs_state
    ORDER BY cc.created_at ASC
    LIMIT p_max_new_cards
  ),
  due_cards AS (
    SELECT
      cc.vocabulary_id,
      cc.term,
      cc.definition,
      cc.example,
      cc.sense_key,
      cc.id,
      cc.state,
      cc.stability,
      cc.difficulty,
      cc.total_reviews,
      cc.streak_incorrect,
      cc.due,
      cc.last_reviewed_date,
      cc.first_seen_date
    FROM chapter_cards cc
    WHERE cc.due <= v_now
      AND cc.state != 'New'::srs_state
    ORDER BY cc.due ASC
    LIMIT v_remaining_slots
  )
  SELECT
    combined.vocabulary_id,
    combined.term,
    combined.definition,
    combined.example,
    combined.sense_key,
    combined.id,
    combined.state,
    combined.stability,
    combined.difficulty,
    combined.total_reviews,
    combined.streak_incorrect,
    combined.due,
    combined.last_reviewed_date,
    combined.first_seen_date
  FROM (
    SELECT * FROM new_cards
    UNION ALL
    SELECT * FROM due_cards
  ) combined
  ORDER BY combined.due ASC
  LIMIT p_max_total_cards;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_study_cards(UUID, UUID, INTEGER, INTEGER) TO authenticated;

