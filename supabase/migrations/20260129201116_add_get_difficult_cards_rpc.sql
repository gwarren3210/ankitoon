-- Migration: Add get_difficult_cards RPC function
-- Purpose: Get user's most difficult cards for distractor fallback in learn mode
-- Used when there aren't enough cards in the current session for distractors

CREATE OR REPLACE FUNCTION get_difficult_cards(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  term TEXT,
  definition TEXT,
  difficulty REAL
) AS $$
BEGIN
  -- Return user's most difficult vocabulary cards
  -- Sorted by difficulty DESC (hardest first), then by streak_incorrect DESC
  -- Excludes New cards since they haven't been reviewed yet
  RETURN QUERY
  SELECT
    v.term,
    v.definition,
    srs.difficulty
  FROM user_deck_srs_cards srs
  INNER JOIN vocabulary v ON v.id = srs.vocabulary_id
  WHERE srs.user_id = p_user_id
    AND srs.state != 'New'::srs_state
    AND srs.card_type = 'vocabulary'
  ORDER BY srs.difficulty DESC, srs.streak_incorrect DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_difficult_cards(UUID, INTEGER) TO authenticated;

COMMENT ON FUNCTION get_difficult_cards IS
  'Retrieves user''s most difficult vocabulary cards for use as distractors '
  'in learn mode multiple choice questions. Ordered by difficulty descending.';
