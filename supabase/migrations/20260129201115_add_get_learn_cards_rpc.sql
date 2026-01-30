-- Migration: Add get_learn_cards RPC function
-- Purpose: Fetches only NEW cards for learn session (multiple choice quiz)
-- Returns vocabulary and grammar cards that have never been reviewed

CREATE OR REPLACE FUNCTION get_learn_cards(
  p_user_id UUID,
  p_chapter_id UUID
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

  -- Return only NEW cards (vocabulary + grammar)
  RETURN QUERY
  -- Vocabulary cards
  SELECT
    srs.id AS srs_card_id,
    srs.deck_id,
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

  UNION ALL

  -- Grammar cards
  SELECT
    srs.id AS srs_card_id,
    srs.deck_id,
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

  ORDER BY srs_card_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_learn_cards(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION get_learn_cards IS
  'Retrieves NEW cards (vocabulary and grammar) for a chapter learn session. '
  'Only returns cards with state=New that have never been reviewed.';
