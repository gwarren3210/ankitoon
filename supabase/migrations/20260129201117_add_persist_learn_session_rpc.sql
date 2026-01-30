-- Migration: Add persist_learn_session RPC function
-- Purpose: Batch update cards when learn session completes
-- Applies FSRS state from client after cards graduate from learn phase

CREATE OR REPLACE FUNCTION persist_learn_session(
  p_user_id UUID,
  p_deck_id UUID,
  p_graduated_cards JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_card JSONB;
  v_count INTEGER := 0;
BEGIN
  -- Validate input
  IF p_graduated_cards IS NULL OR jsonb_array_length(p_graduated_cards) = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'cards_graduated', 0
    );
  END IF;

  -- Update each graduated card with FSRS state from client
  FOR v_card IN SELECT * FROM jsonb_array_elements(p_graduated_cards)
  LOOP
    UPDATE user_deck_srs_cards
    SET
      state = (v_card->>'state')::srs_state,
      stability = (v_card->>'stability')::REAL,
      difficulty = (v_card->>'difficulty')::REAL,
      due = (v_card->>'due')::TIMESTAMP WITH TIME ZONE,
      scheduled_days = COALESCE((v_card->>'scheduled_days')::INTEGER, 0),
      learning_steps = COALESCE((v_card->>'learning_steps')::INTEGER, 0),
      total_reviews = COALESCE(total_reviews, 0) + 1,
      last_reviewed_date = NOW(),
      updated_at = NOW()
    WHERE id = (v_card->>'srs_card_id')::UUID
      AND user_id = p_user_id
      AND deck_id = p_deck_id;

    -- Only count if a row was actually updated
    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- Return success result
  RETURN jsonb_build_object(
    'success', true,
    'cards_graduated', v_count
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error persisting learn session: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION persist_learn_session(UUID, UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION persist_learn_session IS
  'Persists graduated cards from a learn session. '
  'Updates each card with FSRS state (stability, difficulty, due date, etc.) '
  'calculated on the client after the card was answered correctly twice.';
