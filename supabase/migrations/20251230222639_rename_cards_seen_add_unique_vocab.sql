-- Rename cards_studied to num_cards_studied
ALTER TABLE user_chapter_progress_summary
  RENAME COLUMN cards_studied TO num_cards_studied;

-- Add unique_vocab_seen column with default 0 and NOT NULL
ALTER TABLE user_chapter_progress_summary
  ADD COLUMN unique_vocab_seen INTEGER NOT NULL DEFAULT 0;

