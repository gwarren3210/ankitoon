Run TypeScript type checking and fix any type errors.

## Instructions

1. Run `bunx tsc --noEmit` to check for type errors without emitting files
2. If errors are found:
   - Group errors by file for systematic fixing
   - Read each file with errors to understand the context
   - Fix errors in order of dependency (shared types first)

3. For each error, explain:
   - What TypeScript expects
   - Why the current code doesn't satisfy that
   - The fix applied

4. After fixing, re-run type check to confirm all errors resolved

## Project Context

- Database types are in `src/types/database.types.ts` (auto-generated)
- Custom types are in `src/types/` directory
- Uses strict TypeScript settings
- Supabase client types come from `@supabase/supabase-js`
- FSRS types come from `ts-fsrs` package

## Common Patterns

- API routes use `NextRequest` and `NextResponse` from `next/server`
- Supabase queries return `{ data, error }` - always handle both
- Use `Tables<'table_name'>` for database row types
- Use `Enums<'enum_name'>` for database enum types

## Optional Arguments

If the user provides a specific file or directory, check only that:
- `bunx tsc --noEmit <file>` for single file
- Or read specific files mentioned

$ARGUMENTS
