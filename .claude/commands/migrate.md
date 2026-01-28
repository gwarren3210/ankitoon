Help create or review Supabase database migrations.

## Instructions

### For Creating New Migrations

1. Understand what schema change is needed
2. Check existing migrations in `supabase/migrations/` for patterns
3. Create a new migration file with timestamp naming:
   - Format: `YYYYMMDDHHMMSS_description.sql`
4. Include in the migration:
   - The schema change (CREATE, ALTER, etc.)
   - Row Level Security (RLS) policies if adding tables
   - Indexes for commonly queried columns
   - Comments explaining the change

### For Reviewing Migrations

1. Read the migration file
2. Check for:
   - RLS policies on new tables (required for user data)
   - Proper foreign key relationships
   - Index coverage for query patterns
   - Backward compatibility concerns

## Project Schema Patterns

Key tables and their relationships:
- `profiles` - User data (RLS: own data only)
- `series`, `chapters`, `vocabulary` - Content (public read)
- `chapter_vocabulary` - Junction table for chapter-vocab relationship
- `user_deck_srs_cards` - User's SRS card state (RLS: own data only)
- `user_chapter_progress_summary` - Per-chapter progress (RLS)
- `user_series_progress_summary` - Per-series progress (RLS)

## RLS Policy Template

```sql
-- Enable RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own data"
  ON new_table FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own data
CREATE POLICY "Users can insert own data"
  ON new_table FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own data
CREATE POLICY "Users can update own data"
  ON new_table FOR UPDATE
  USING (auth.uid() = user_id);
```

## Sense Key Pattern

When adding vocabulary-related columns, remember:
- `vocabulary` table uses composite unique on `(term, sense_key)`
- `sense_key` disambiguates homonyms (e.g., "mal_horse" vs "mal_speech")

## Optional Arguments

Describe the migration needed or provide a file to review.

$ARGUMENTS
