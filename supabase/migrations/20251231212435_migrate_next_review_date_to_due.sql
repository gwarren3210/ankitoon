-- Migration to migrate next_review_date to due column and remove next_review_date
-- Consolidates duplicate date columns to avoid confusion

-- Step 1: Copy data from next_review_date to due where due is NULL
UPDATE user_deck_srs_cards
SET due = next_review_date
WHERE due IS NULL 
  AND next_review_date IS NOT NULL;

-- Step 2: Drop the index on next_review_date
DROP INDEX IF EXISTS idx_user_deck_srs_cards_next_review;

-- Step 3: Update the RPC function to use 'due' instead of 'next_review_date'
CREATE OR REPLACE FUNCTION persist_session_reviews(
  p_user_id UUID,
  p_deck_id UUID,
  p_card_updates JSONB,
  p_review_logs JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_card_update JSONB;
  v_review_log JSONB;
  v_srs_card_id UUID;
  v_result JSONB;
BEGIN
  -- Start transaction (implicit in function)
  
  -- Process card updates
  FOR v_card_update IN SELECT * FROM jsonb_array_elements(p_card_updates)
  LOOP
    INSERT INTO user_deck_srs_cards (
      deck_id,
      vocabulary_id,
      user_id,
      state,
      stability,
      difficulty,
      total_reviews,
      streak_incorrect,
      due,
      last_reviewed_date
    )
    VALUES (
      p_deck_id,
      (v_card_update->>'vocabulary_id')::UUID,
      p_user_id,
      (v_card_update->>'state')::srs_state,
      (v_card_update->>'stability')::REAL,
      (v_card_update->>'difficulty')::REAL,
      (v_card_update->>'total_reviews')::INTEGER,
      (v_card_update->>'streak_incorrect')::INTEGER,
      (v_card_update->>'due')::TIMESTAMP WITH TIME ZONE,
      CASE 
        WHEN v_card_update->>'last_reviewed_date' IS NULL THEN NULL
        ELSE (v_card_update->>'last_reviewed_date')::TIMESTAMP WITH TIME ZONE
      END
    )
    ON CONFLICT (deck_id, vocabulary_id, user_id)
    DO UPDATE SET
      state = EXCLUDED.state,
      stability = EXCLUDED.stability,
      difficulty = EXCLUDED.difficulty,
      total_reviews = EXCLUDED.total_reviews,
      streak_incorrect = EXCLUDED.streak_incorrect,
      due = EXCLUDED.due,
      last_reviewed_date = EXCLUDED.last_reviewed_date,
      updated_at = NOW();
  END LOOP;

  -- Process review logs (need to get srs_card_id for each)
  FOR v_review_log IN SELECT * FROM jsonb_array_elements(p_review_logs)
  LOOP
    -- Use srs_card_id from JSON if provided, otherwise look it up
    IF v_review_log->>'srs_card_id' IS NOT NULL AND v_review_log->>'srs_card_id' != '' THEN
      v_srs_card_id := (v_review_log->>'srs_card_id')::UUID;
    ELSE
      -- Get srs_card_id if it exists
      SELECT id INTO v_srs_card_id
      FROM user_deck_srs_cards
      WHERE deck_id = p_deck_id
        AND vocabulary_id = (v_review_log->>'vocabulary_id')::UUID
        AND user_id = p_user_id
      LIMIT 1;
    END IF;

    INSERT INTO srs_progress_logs (
      user_id,
      vocabulary_id,
      srs_card_id,
      due,
      stability,
      difficulty,
      elapsed_days,
      scheduled_days,
      learning_steps,
      reps,
      lapses,
      state,
      last_review,
      rating,
      review
    )
    VALUES (
      p_user_id,
      (v_review_log->>'vocabulary_id')::UUID,
      v_srs_card_id,
      (v_review_log->>'due')::TIMESTAMP WITH TIME ZONE,
      (v_review_log->>'stability')::REAL,
      (v_review_log->>'difficulty')::REAL,
      (v_review_log->>'elapsed_days')::INTEGER,
      (v_review_log->>'scheduled_days')::INTEGER,
      CASE 
        WHEN v_review_log->>'learning_steps' IS NULL THEN NULL
        ELSE (v_review_log->>'learning_steps')::INTEGER
      END,
      CASE 
        WHEN v_review_log->>'reps' IS NULL THEN 0
        ELSE (v_review_log->>'reps')::INTEGER
      END,
      CASE 
        WHEN v_review_log->>'lapses' IS NULL THEN 0
        ELSE (v_review_log->>'lapses')::INTEGER
      END,
      (v_review_log->>'state')::srs_state,
      CASE 
        WHEN v_review_log->>'last_review' IS NULL THEN NULL
        ELSE (v_review_log->>'last_review')::TIMESTAMP WITH TIME ZONE
      END,
      CASE 
        WHEN v_review_log->>'rating' IS NULL THEN NULL
        ELSE (v_review_log->>'rating')::rating_type
      END,
      (v_review_log->>'review')::TIMESTAMP WITH TIME ZONE
    );
  END LOOP;

  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'cards_updated', jsonb_array_length(p_card_updates),
    'logs_inserted', jsonb_array_length(p_review_logs)
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    -- Rollback transaction (implicit in function)
    RAISE EXCEPTION 'Error persisting session reviews: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create new index on due column
CREATE INDEX idx_user_deck_srs_cards_due ON user_deck_srs_cards(user_id, due)
  WHERE due IS NOT NULL;

-- Step 5: Drop the next_review_date column
ALTER TABLE user_deck_srs_cards
DROP COLUMN IF EXISTS next_review_date;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION persist_session_reviews(UUID, UUID, JSONB, JSONB) TO authenticated;

COMMENT ON FUNCTION persist_session_reviews IS 'Persists session reviews in a transaction. Updates SRS cards and inserts review logs atomically. Returns JSONB with success status and counts.';

