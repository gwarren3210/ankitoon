-- Add sense_key column to vocabulary table for homonym disambiguation
-- Each term can have multiple meanings, distinguished by sense_key

-- Add sense_key column with default value
ALTER TABLE vocabulary 
ADD COLUMN sense_key TEXT NOT NULL DEFAULT 'general';

-- Drop existing non-unique index on term
DROP INDEX IF EXISTS idx_vocabulary_term;

-- Create unique composite index on (term, sense_key)
-- This allows same term with different sense_keys
CREATE UNIQUE INDEX idx_vocabulary_term_sense 
ON vocabulary(term, sense_key);

-- Create simple index on term for lookups
CREATE INDEX idx_vocabulary_term ON vocabulary(term);

