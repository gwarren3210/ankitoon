-- Make cards_studied non-nullable with default 0
-- Update existing NULL values to 0
UPDATE user_chapter_progress_summary
SET cards_studied = 0
WHERE cards_studied IS NULL;

-- Add NOT NULL constraint with default
ALTER TABLE user_chapter_progress_summary
  ALTER COLUMN cards_studied SET DEFAULT 0,
  ALTER COLUMN cards_studied SET NOT NULL;

