-- Add external_url column to chapters table for linking to original webtoon sources
ALTER TABLE chapters
ADD COLUMN external_url TEXT;

COMMENT ON COLUMN chapters.external_url IS
  'External link to original webtoon chapter';
