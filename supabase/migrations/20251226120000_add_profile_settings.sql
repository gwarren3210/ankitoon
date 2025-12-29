-- Add profile settings columns to profiles table
-- Allows users to customize study session limits and FSRS parameters

ALTER TABLE profiles
ADD COLUMN max_new_cards INTEGER DEFAULT 10,
ADD COLUMN max_total_cards INTEGER DEFAULT 30;

COMMENT ON COLUMN profiles.max_new_cards IS 'Maximum number of new cards to include in a study session';
COMMENT ON COLUMN profiles.max_total_cards IS 'Maximum total number of cards (new + review) in a study session';

-- Update trigger to set updated_at on changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_profiles_updated_at
      BEFORE UPDATE ON profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

