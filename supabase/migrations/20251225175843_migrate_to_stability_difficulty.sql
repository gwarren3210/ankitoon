-- Migration to replace review_interval_days and ease_factor with stability and difficulty
-- Aligns database schema with ts-fsrs Card interface field names
-- No data migration needed as stated

-- Add new columns with comments explaining their purpose
ALTER TABLE user_deck_srs_cards
ADD COLUMN stability REAL NOT NULL,
ADD COLUMN difficulty REAL NOT NULL;

COMMENT ON COLUMN user_deck_srs_cards.stability IS 'FSRS stability value representing how well the card is remembered. Higher values mean longer intervals between reviews.';
COMMENT ON COLUMN user_deck_srs_cards.difficulty IS 'FSRS difficulty value representing how hard the card is to remember. Range typically 1.3 to 2.5, where higher means more difficult.';
COMMENT ON COLUMN user_deck_srs_cards.state IS 'FSRS state enum: New (never studied), Learning (in learning phase), Review (matured card), or Relearning (previously forgotten).';
COMMENT ON COLUMN user_deck_srs_cards.due IS 'FSRS due date for when the card should be reviewed next. Maps to Card.due in ts-fsrs.';
COMMENT ON COLUMN user_deck_srs_cards.scheduled_days IS 'FSRS scheduled days between reviews. Used to calculate the next review date. Maps to Card.scheduled_days in ts-fsrs.';
COMMENT ON COLUMN user_deck_srs_cards.learning_steps IS 'FSRS learning steps remaining. Tracks progress through the initial learning phase. Maps to Card.learning_steps in ts-fsrs.';
COMMENT ON COLUMN user_deck_srs_cards.total_reviews IS 'Total number of times this card has been reviewed. Maps to Card.reps in ts-fsrs.';
COMMENT ON COLUMN user_deck_srs_cards.streak_correct IS 'Number of consecutive correct reviews. Used for streak tracking and user motivation.';
COMMENT ON COLUMN user_deck_srs_cards.streak_incorrect IS 'Number of consecutive incorrect reviews. Maps to Card.lapses in ts-fsrs.';
COMMENT ON COLUMN user_deck_srs_cards.next_review_date IS 'Timestamp when the card is due for next review. Used for querying due cards.';
COMMENT ON COLUMN user_deck_srs_cards.last_reviewed_date IS 'Timestamp of the last review. Maps to Card.last_review in ts-fsrs.';
COMMENT ON COLUMN user_deck_srs_cards.first_seen_date IS 'Timestamp when the card was first encountered by the user. Used for tracking learning timeline.';

-- Drop old columns
ALTER TABLE user_deck_srs_cards
DROP COLUMN review_interval_days,
DROP COLUMN ease_factor;

