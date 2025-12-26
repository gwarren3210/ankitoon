-- Make chapters_completed non-nullable with default 0 in user_series_progress_summary
UPDATE user_series_progress_summary
SET chapters_completed = 0
WHERE chapters_completed IS NULL;

ALTER TABLE user_series_progress_summary
  ALTER COLUMN chapters_completed SET DEFAULT 0,
  ALTER COLUMN chapters_completed SET NOT NULL;

-- Make importance_score non-nullable with default 0 in chapter_vocabulary
UPDATE chapter_vocabulary
SET importance_score = 0
WHERE importance_score IS NULL;

ALTER TABLE chapter_vocabulary
  ALTER COLUMN importance_score SET DEFAULT 0,
  ALTER COLUMN importance_score SET NOT NULL;

