-- Migration: Add grammar pattern storage and study support
-- Creates grammar/chapter_grammar tables and extends SRS cards for grammar

-- ============================================================================
-- STEP 1: CREATE CARD TYPE ENUM
-- ============================================================================

CREATE TYPE card_type AS ENUM ('vocabulary', 'grammar');

-- ============================================================================
-- STEP 2: CREATE GRAMMAR TABLES
-- ============================================================================

-- Grammar patterns table (parallel to vocabulary)
CREATE TABLE grammar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT NOT NULL,
  definition TEXT NOT NULL,
  example TEXT,
  sense_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (pattern, sense_key)
);

CREATE INDEX idx_grammar_pattern ON grammar(pattern);
CREATE INDEX idx_grammar_sense_key ON grammar(sense_key);

-- Chapter-grammar join table (parallel to chapter_vocabulary)
CREATE TABLE chapter_grammar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  grammar_id UUID NOT NULL REFERENCES grammar(id) ON DELETE CASCADE,
  importance_score INTEGER DEFAULT 0,
  example TEXT,
  UNIQUE (chapter_id, grammar_id)
);

CREATE INDEX idx_chapter_grammar_chapter_id ON chapter_grammar(chapter_id);
CREATE INDEX idx_chapter_grammar_grammar_id ON chapter_grammar(grammar_id);

-- ============================================================================
-- STEP 3: EXTEND SRS CARDS TABLE
-- ============================================================================

-- Add card_type column with default for existing data
ALTER TABLE user_deck_srs_cards
  ADD COLUMN card_type card_type NOT NULL DEFAULT 'vocabulary';

-- Add grammar_id column
ALTER TABLE user_deck_srs_cards
  ADD COLUMN grammar_id UUID REFERENCES grammar(id) ON DELETE CASCADE;

-- Make vocabulary_id nullable (required for grammar cards)
ALTER TABLE user_deck_srs_cards
  ALTER COLUMN vocabulary_id DROP NOT NULL;

-- Drop old unique constraint
ALTER TABLE user_deck_srs_cards
  DROP CONSTRAINT IF EXISTS user_deck_srs_cards_vocabulary_id_user_id_key;

-- Add new unique constraints for each card type
-- Vocabulary cards: unique on (vocabulary_id, user_id) where card_type = 'vocabulary'
CREATE UNIQUE INDEX idx_srs_cards_vocabulary_unique
  ON user_deck_srs_cards (vocabulary_id, user_id)
  WHERE card_type = 'vocabulary' AND vocabulary_id IS NOT NULL;

-- Grammar cards: unique on (grammar_id, user_id) where card_type = 'grammar'
CREATE UNIQUE INDEX idx_srs_cards_grammar_unique
  ON user_deck_srs_cards (grammar_id, user_id)
  WHERE card_type = 'grammar' AND grammar_id IS NOT NULL;

-- Add check constraint for referential integrity
-- Ensures exactly one of vocabulary_id or grammar_id is set based on card_type
ALTER TABLE user_deck_srs_cards
  ADD CONSTRAINT card_reference_check
  CHECK (
    (card_type = 'vocabulary' AND vocabulary_id IS NOT NULL AND grammar_id IS NULL) OR
    (card_type = 'grammar' AND grammar_id IS NOT NULL AND vocabulary_id IS NULL)
  );

-- ============================================================================
-- STEP 4: EXTEND PROGRESS LOGS TABLE
-- ============================================================================

ALTER TABLE srs_progress_logs
  ADD COLUMN grammar_id UUID REFERENCES grammar(id),
  ADD COLUMN card_type card_type NOT NULL DEFAULT 'vocabulary';

-- ============================================================================
-- STEP 5: RLS POLICIES FOR NEW TABLES
-- ============================================================================

-- Grammar is viewable by authenticated users
ALTER TABLE grammar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Grammar is viewable by authenticated users"
  ON grammar FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admin can insert/update/delete grammar
CREATE POLICY "Admins can insert grammar"
  ON grammar FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update grammar"
  ON grammar FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete grammar"
  ON grammar FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Chapter grammar is viewable by authenticated users
ALTER TABLE chapter_grammar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chapter grammar is viewable by authenticated users"
  ON chapter_grammar FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert chapter grammar"
  ON chapter_grammar FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update chapter grammar"
  ON chapter_grammar FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete chapter grammar"
  ON chapter_grammar FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- STEP 6: UPDATE GET_STUDY_CARDS RPC
-- ============================================================================

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
GRANT EXECUTE ON FUNCTION get_study_cards(UUID, UUID) TO authenticated;

-- ============================================================================
-- STEP 7: UPDATE PERSIST_SESSION_REVIEWS RPC
-- ============================================================================

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
  v_card_type card_type;
  v_vocabulary_id UUID;
  v_grammar_id UUID;
BEGIN
  -- Process card updates
  FOR v_card_update IN SELECT * FROM jsonb_array_elements(p_card_updates)
  LOOP
    -- Determine card type and IDs
    v_card_type := COALESCE(
      (v_card_update->>'card_type')::card_type,
      'vocabulary'
    );
    v_vocabulary_id := NULLIF(v_card_update->>'vocabulary_id', '')::UUID;
    v_grammar_id := NULLIF(v_card_update->>'grammar_id', '')::UUID;

    IF v_card_type = 'vocabulary' THEN
      -- Vocabulary card: upsert by vocabulary_id
      INSERT INTO user_deck_srs_cards (
        deck_id,
        vocabulary_id,
        grammar_id,
        user_id,
        card_type,
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
        v_vocabulary_id,
        NULL,
        p_user_id,
        'vocabulary',
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
      ON CONFLICT (vocabulary_id, user_id)
        WHERE card_type = 'vocabulary' AND vocabulary_id IS NOT NULL
      DO UPDATE SET
        state = EXCLUDED.state,
        stability = EXCLUDED.stability,
        difficulty = EXCLUDED.difficulty,
        total_reviews = EXCLUDED.total_reviews,
        streak_incorrect = EXCLUDED.streak_incorrect,
        due = EXCLUDED.due,
        last_reviewed_date = EXCLUDED.last_reviewed_date,
        updated_at = NOW();
    ELSE
      -- Grammar card: upsert by grammar_id
      INSERT INTO user_deck_srs_cards (
        deck_id,
        vocabulary_id,
        grammar_id,
        user_id,
        card_type,
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
        NULL,
        v_grammar_id,
        p_user_id,
        'grammar',
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
      ON CONFLICT (grammar_id, user_id)
        WHERE card_type = 'grammar' AND grammar_id IS NOT NULL
      DO UPDATE SET
        state = EXCLUDED.state,
        stability = EXCLUDED.stability,
        difficulty = EXCLUDED.difficulty,
        total_reviews = EXCLUDED.total_reviews,
        streak_incorrect = EXCLUDED.streak_incorrect,
        due = EXCLUDED.due,
        last_reviewed_date = EXCLUDED.last_reviewed_date,
        updated_at = NOW();
    END IF;
  END LOOP;

  -- Process review logs
  FOR v_review_log IN SELECT * FROM jsonb_array_elements(p_review_logs)
  LOOP
    v_card_type := COALESCE(
      (v_review_log->>'card_type')::card_type,
      'vocabulary'
    );
    v_vocabulary_id := NULLIF(v_review_log->>'vocabulary_id', '')::UUID;
    v_grammar_id := NULLIF(v_review_log->>'grammar_id', '')::UUID;

    -- Use srs_card_id from JSON if provided, otherwise look it up
    IF v_review_log->>'srs_card_id' IS NOT NULL AND v_review_log->>'srs_card_id' != '' THEN
      v_srs_card_id := (v_review_log->>'srs_card_id')::UUID;
    ELSIF v_card_type = 'vocabulary' THEN
      SELECT id INTO v_srs_card_id
      FROM user_deck_srs_cards
      WHERE vocabulary_id = v_vocabulary_id
        AND user_id = p_user_id
        AND card_type = 'vocabulary'
      LIMIT 1;
    ELSE
      SELECT id INTO v_srs_card_id
      FROM user_deck_srs_cards
      WHERE grammar_id = v_grammar_id
        AND user_id = p_user_id
        AND card_type = 'grammar'
      LIMIT 1;
    END IF;

    INSERT INTO srs_progress_logs (
      user_id,
      vocabulary_id,
      grammar_id,
      card_type,
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
      v_vocabulary_id,
      v_grammar_id,
      v_card_type,
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
      COALESCE((v_review_log->>'reps')::INTEGER, 0),
      COALESCE((v_review_log->>'lapses')::INTEGER, 0),
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
    RAISE EXCEPTION 'Error persisting session reviews: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION persist_session_reviews(UUID, UUID, JSONB, JSONB) TO authenticated;

COMMENT ON FUNCTION persist_session_reviews IS
  'Persists session reviews for both vocabulary and grammar cards. '
  'Card updates and review logs are processed atomically. '
  'Returns JSONB with success status and counts.';
