-- Update get_study_cards RPC to return both examples properly labeled
-- Changes:
-- 1. Return example (global generic example from vocabulary table)
-- 2. Return chapter_example (chapter-specific example from chapter_vocabulary table)
-- 3. Both examples are returned separately and properly labeled

DROP FUNCTION IF EXISTS get_study_cards(UUID, UUID);

CREATE OR REPLACE FUNCTION get_study_cards(
  p_user_id UUID,
  p_chapter_id UUID
)
RETURNS TABLE (
  vocabulary_id UUID,
  term TEXT,
  definition TEXT,
  example TEXT,
  chapter_example TEXT,
  sense_key TEXT,
  vocabulary_created_at TIMESTAMP WITH TIME ZONE,
  srs_card_id UUID,
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

  -- Return new cards first (up to max_new_cards), then due cards to fill remaining slots
  RETURN QUERY
  WITH chapter_cards AS (
    SELECT
      v.id AS vocabulary_id,
      v.term,
      v.definition,
      v.example,
      cv.example AS chapter_example,
      v.sense_key,
      v.created_at AS vocabulary_created_at,
      srs.id AS srs_card_id,
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
      srs.created_at
    FROM user_deck_srs_cards srs
    INNER JOIN vocabulary v ON v.id = srs.vocabulary_id
    INNER JOIN chapter_vocabulary cv ON cv.vocabulary_id = srs.vocabulary_id
    WHERE srs.user_id = p_user_id
      AND srs.deck_id = v_deck_id
      AND cv.chapter_id = p_chapter_id
      AND (
        srs.state = 'New'::srs_state
        OR srs.due <= v_now
      )
  ),
  new_cards AS (
    SELECT
      cc.vocabulary_id,
      cc.term,
      cc.definition,
      cc.example,
      cc.chapter_example,
      cc.sense_key,
      cc.vocabulary_created_at,
      cc.srs_card_id,
      cc.state,
      cc.stability,
      cc.difficulty,
      cc.total_reviews,
      cc.streak_incorrect,
      cc.due,
      cc.last_reviewed_date,
      cc.first_seen_date,
      cc.scheduled_days,
      cc.learning_steps
    FROM chapter_cards cc
    WHERE cc.state = 'New'::srs_state
    ORDER BY cc.created_at ASC
    LIMIT v_max_new_cards
  ),
  due_cards AS (
    SELECT
      cc.vocabulary_id,
      cc.term,
      cc.definition,
      cc.example,
      cc.chapter_example,
      cc.sense_key,
      cc.vocabulary_created_at,
      cc.srs_card_id,
      cc.state,
      cc.stability,
      cc.difficulty,
      cc.total_reviews,
      cc.streak_incorrect,
      cc.due,
      cc.last_reviewed_date,
      cc.first_seen_date,
      cc.scheduled_days,
      cc.learning_steps
    FROM chapter_cards cc
    WHERE cc.due <= v_now
      AND cc.state != 'New'::srs_state
    ORDER BY cc.due ASC
  )
  SELECT
    combined.vocabulary_id,
    combined.term,
    combined.definition,
    combined.example,
    combined.chapter_example,
    combined.sense_key,
    combined.vocabulary_created_at,
    combined.srs_card_id,
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

