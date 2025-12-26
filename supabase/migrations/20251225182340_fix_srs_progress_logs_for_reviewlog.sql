-- Migration to align srs_progress_logs with FSRS ReviewLog interface
-- Adds missing fields and fixes type mismatches

-- Create rating enum type matching ts-fsrs Rating enum
-- Rating values: Manual=0, Again=1, Hard=2, Good=3, Easy=4
CREATE TYPE rating_type AS ENUM ('Manual', 'Again', 'Hard', 'Good', 'Easy');

-- Add missing rating field
ALTER TABLE srs_progress_logs
ADD COLUMN rating rating_type;

COMMENT ON COLUMN srs_progress_logs.rating IS 'FSRS rating given by user: Manual (0), Again (1), Hard (2), Good (3), or Easy (4). Maps to ReviewLog.rating in ts-fsrs.';

-- Add review timestamp field (when the review happened)
ALTER TABLE srs_progress_logs
ADD COLUMN review TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN srs_progress_logs.review IS 'Timestamp when the review was performed. Maps to ReviewLog.review in ts-fsrs. Differs from last_review which tracks the card state.';

-- Fix learning_steps type: change from JSONB to INTEGER to match ReviewLog.learning_steps
-- First drop the column, then add it back with correct type
ALTER TABLE srs_progress_logs
DROP COLUMN learning_steps;

ALTER TABLE srs_progress_logs
ADD COLUMN learning_steps INTEGER;

COMMENT ON COLUMN srs_progress_logs.learning_steps IS 'FSRS learning steps remaining. Number of steps left in the learning phase. Maps to ReviewLog.learning_steps in ts-fsrs.';

-- Add comments for all existing FSRS columns
COMMENT ON COLUMN srs_progress_logs.due IS 'FSRS due date for when the card should be reviewed next. Maps to ReviewLog.due in ts-fsrs.';
COMMENT ON COLUMN srs_progress_logs.stability IS 'FSRS stability value representing how well the card is remembered. Higher values mean longer intervals between reviews. Maps to ReviewLog.stability in ts-fsrs.';
COMMENT ON COLUMN srs_progress_logs.difficulty IS 'FSRS difficulty value representing how hard the card is to remember. Range typically 1.3 to 2.5, where higher means more difficult. Maps to ReviewLog.difficulty in ts-fsrs.';
COMMENT ON COLUMN srs_progress_logs.elapsed_days IS 'FSRS elapsed days since last review. Deprecated in FSRS v6.0.0 but still stored for historical tracking. Maps to ReviewLog.elapsed_days in ts-fsrs.';
COMMENT ON COLUMN srs_progress_logs.scheduled_days IS 'FSRS scheduled days between reviews. Used to calculate the next review date. Maps to ReviewLog.scheduled_days in ts-fsrs.';
COMMENT ON COLUMN srs_progress_logs.reps IS 'Total number of times this card has been reviewed. Maps to ReviewLog indirectly (not directly in ReviewLog but tracks review count).';
COMMENT ON COLUMN srs_progress_logs.lapses IS 'Number of times the card was forgotten or answered incorrectly. Maps to ReviewLog indirectly (not directly in ReviewLog but tracks failure count).';
COMMENT ON COLUMN srs_progress_logs.state IS 'FSRS state enum: New (never studied), Learning (in learning phase), Review (matured card), or Relearning (previously forgotten). Maps to ReviewLog.state in ts-fsrs.';
COMMENT ON COLUMN srs_progress_logs.last_review IS 'Timestamp of the last review before this log entry. Tracks card state, differs from review which is when this specific log entry was created.';

