-- Update any NULL created_at values to NOW()
UPDATE vocabulary
SET created_at = NOW()
WHERE created_at IS NULL;

-- Make created_at NOT NULL and ensure default is set
ALTER TABLE vocabulary
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN created_at SET NOT NULL;

