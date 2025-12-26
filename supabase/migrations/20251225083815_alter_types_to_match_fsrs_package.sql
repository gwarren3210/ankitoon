-- Migration to update srs_state enum to match FSRS package states
-- FSRS uses: New, Learning, Review, Relearning
-- Since there's no existing data, we can simply drop and recreate

-- Step 1: Drop columns that use the enum
ALTER TABLE user_deck_srs_cards DROP COLUMN state;
ALTER TABLE srs_progress_logs DROP COLUMN state;

-- Step 2: Drop the old enum type
DROP TYPE srs_state;

-- Step 3: Create new enum with FSRS values
CREATE TYPE srs_state AS ENUM ('New', 'Learning', 'Review', 'Relearning');

-- Step 4: Add columns back with new enum type
ALTER TABLE user_deck_srs_cards 
  ADD COLUMN state srs_state NOT NULL DEFAULT 'New'::srs_state;

ALTER TABLE srs_progress_logs 
  ADD COLUMN state srs_state NOT NULL DEFAULT 'New'::srs_state;
