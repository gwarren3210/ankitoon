-- Add chapter_dialog table for storing processed dialogue and OCR bounding boxes
-- Enables vocabulary regeneration without re-running OCR

CREATE TABLE chapter_dialog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,

  -- All dialogue text combined (what gets sent to Gemini)
  dialogue_text TEXT NOT NULL,

  -- Raw OCR results: [{ text: string, bbox: { x, y, width, height } }]
  ocr_results JSONB NOT NULL DEFAULT '[]',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (chapter_id)
);

CREATE INDEX idx_chapter_dialog_chapter_id ON chapter_dialog(chapter_id);

-- RLS policies
ALTER TABLE chapter_dialog ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read (for future features)
CREATE POLICY "Authenticated users can read chapter_dialog"
  ON chapter_dialog
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role can insert/update (pipeline operations)
CREATE POLICY "Service role can manage chapter_dialog"
  ON chapter_dialog
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
