# Development Learnings - Login System Implementation

**Date:** December 22, 2025  
**Session:** Login system, authentication, and initial setup

---

## Table of Contents

1. [Authentication Setup](#authentication-setup)
2. [UI Components](#ui-components)
3. [Route Organization](#route-organization)
4. [Role-Based Access Control](#role-based-access-control)
5. [Anonymous Authentication](#anonymous-authentication)
6. [Next.js 16 Specifics](#nextjs-16-specifics)
7. [Project Structure](#project-structure)
8. [Database Migrations](#database-migrations)
9. [Development Workflow](#development-workflow)

---

## Authentication Setup

### Supabase Auth Integration

**Key Files:**
- `/src/lib/supabase/client.ts` - Browser client
- `/src/lib/supabase/server.ts` - Server component client
- `/src/lib/supabase/proxy.ts` - Middleware for session management

**Pattern Used:**
```typescript
// Client-side (login/signup pages)
const supabase = createClient()
await supabase.auth.signInWithPassword({ email, password })

// Server-side (browse page)
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
```

**Learning:** Always use the appropriate client based on context:
- Client components: `createClient()` from `/lib/supabase/client`
- Server components: `await createClient()` from `/lib/supabase/server`
- Middleware: `updateSession()` from `/lib/supabase/proxy`

---

## UI Components

### shadcn/ui Setup

**Installation:**
```bash
npx shadcn@latest add button input card label --yes
```

**Components Created:**
- `/src/components/ui/button.tsx`
- `/src/components/ui/input.tsx`
- `/src/components/ui/card.tsx`
- `/src/components/ui/label.tsx`

**Configuration:** `components.json`
- Style: "new-york"
- Base color: "neutral"
- CSS variables: enabled
- Tailwind config location: `src/app/globals.css`

**Learning:** shadcn/ui components are:
- Copied into your project (not npm packages)
- Fully customizable
- Built on Radix UI primitives
- Already configured with dark mode support

---

## Route Organization

### Next.js App Router - Route Groups

**Pattern Used:** `(auth)` route group

**Structure:**
```
src/app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx      → URL: /login
│   └── signup/
│       └── page.tsx      → URL: /signup
├── browse/
│   └── page.tsx          → URL: /browse
└── page.tsx              → URL: /
```

**Learning:** 
- Parentheses `(auth)` create organizational folders
- They DON'T appear in the URL
- Useful for grouping related pages visually

---

## Role-Based Access Control

### Admin System Implementation

**Migration:** `20251222071936_add_user_roles.sql`

**Key Changes:**
```sql
-- Created enum
CREATE TYPE user_role AS ENUM ('user', 'admin');

-- Added to profiles
ALTER TABLE profiles 
ADD COLUMN role user_role NOT NULL DEFAULT 'user';

-- RLS policies for admins
CREATE POLICY "Admins can insert series"
  ON series FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

**Helper Function:**
```sql
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Learning:**
- RLS (Row Level Security) enforces permissions at database level
- Admins can create/edit series, chapters, vocabulary
- Regular users can only manage their own data
- Use SECURITY DEFINER carefully - it bypasses RLS

**Creating Admin Users:**
```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your-email@example.com';
```

---

## Anonymous Authentication

### Guest Mode Implementation

**Enabling in Supabase:**
```
Dashboard 
  → Authentication 
  → Providers 
  → Anonymous sign-ins 
  → Toggle ON
```

**Implementation:**
```typescript
async function signInAnonymously() {
  const supabase = createClient()
  const { error } = await supabase.auth.signInAnonymously()
  return { error }
}
```

**UI Pattern:**
```
[  Sign In with Email  ]
──────── Or ────────
[ Continue as Guest ]
```

**Features Added:**
- "Continue as Guest" button on login
- Banner prompting guests to create account
- Detection via `user.is_anonymous` flag
- All progress saved to anonymous account

**Learning:**
- Reduces signup friction dramatically
- Great for user acquisition and testing
- Anonymous users can convert to permanent accounts
- But: lost if browser data cleared

**Best Practices:**
- Show persistent banner for anonymous users
- Remind them to sign up to save progress
- Allow easy conversion to permanent account
- Consider limiting some features for guests

---

## Next.js 16 Specifics

### Turbopack (New Default)

**Issue:** Used webpack config, but Next.js 16 uses Turbopack.

**Error:**
```
This build is using Turbopack, with a `webpack` config 
and no `turbopack` config.
```

**Solution:**
```typescript
// next.config.ts
const nextConfig: NextConfig = {
  turbopack: {},  // Empty config to silence warning
};
```

**Learning:**
- Next.js 16 uses Turbopack by default
- Much faster than webpack
- Most apps work without configuration
- Use `turbopack: {}` to silence warnings

### Async Params & SearchParams

**Warning Seen:**
```
The keys of `searchParams` were accessed directly. 
`searchParams` is a Promise and must be unwrapped 
with `React.use()`
```

**Cause:**
- React DevTools inspecting component props
- Next.js 15+ made params/searchParams async
- DevTools wasn't handling them correctly

**Learning:**
- Warning is from DevTools, NOT your code
- Only appears during development
- Safe to ignore if you're not using params/searchParams
- If using them, await/use React.use():

```typescript
// Old (Next.js 14)
export default function Page({ params }: { 
  params: { slug: string } 
}) {
  return <div>{params.slug}</div>
}

// New (Next.js 15+)
export default async function Page({ params }: { 
  params: Promise<{ slug: string }> 
}) {
  const { slug } = await params
  return <div>{slug}</div>
}
```

### Middleware Deprecation

**Warning:**
```
The "middleware" file convention is deprecated. 
Please use "proxy" instead.
```

**Solution:**
```bash
mv src/middleware.ts src/proxy.ts
```

**Learning:**
- Just a naming change
- `middleware.ts` still works fine
- `proxy.ts` is the future convention
- Non-breaking, can update anytime

---

## Project Structure

### Naming Conventions

**Folders:** kebab-case
```
user-profile/
api-services/
auth-helpers/
```

**Files:** camelCase
```
loginForm.tsx
userData.ts
apiClient.ts
```

**Markdown:** kebab-case
```
rebuild-documentation.md
api-guide.md
```

### File Organization Rules

**1. Single Responsibility**
- Components: Only presentational logic
- Hooks: Only reusable logic
- Services: Only data/API handling

**2. File Size**
- Max ~200-300 lines
- Max 80 characters per line
- Split if larger

**3. Function Documentation**
Functions > 3 lines need:
```typescript
/**
 * Brief description
 * Input: param types
 * Output: return type
 */
function example(input: string): boolean {
  // implementation
}
```

**4. Main Function Pattern**
```typescript
// Main function at top - orchestrates only
export default function LoginPage() {
  const result1 = await helper1()
  const result2 = await helper2()
  return combine(result1, result2)
}

// Helper functions below
async function helper1() { ... }
async function helper2() { ... }
function combine(a, b) { ... }
```

**Learning:** This pattern makes files scannable:
- See main logic immediately at top
- Implementation details below
- Easy to understand flow

---

## Database Migrations

### Supabase Migration Workflow

**Creating Migrations:**
```bash
supabase migration new migration_name
```

**Applying to Remote:**
```bash
supabase db push --linked
```


**Type Generation:**
```bash
supabase gen types typescript --linked > 
  src/types/database.types.ts
```

**Learning:**
- Regenerate types after every migration
- Keeps TypeScript in sync with database
- Catches type errors at compile time

---

## Development Workflow

### Setup Checklist

1. **Install Dependencies**
```bash
npm install
```

2. **Configure Supabase**
```bash
# Link to project
supabase link

# Run migrations
supabase db push --linked

# Generate types
supabase gen types typescript --linked > 
  src/types/database.types.ts
```

3. **Environment Variables**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=xxx
```

4. **Development Settings**

Optional for easier testing:
- Disable email confirmation
- Enable anonymous sign-ins
- Seed sample data

5. **Start Dev Server**
```bash
npm run dev
```

### Common Tasks

**Add UI Component:**
```bash
npx shadcn@latest add component-name --yes
```

**Create Migration:**
```bash
supabase migration new migration_name
# Edit the SQL file
supabase db push --linked
supabase gen types typescript --linked > 
  src/types/database.types.ts
```

**Promote User to Admin:**
```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'email@example.com';
```

**Reset Database:**
```bash
supabase db reset --linked
```

---

## Key Takeaways

### What Worked Well

1. **Route Groups** - Clean organization without URL clutter
2. **shadcn/ui** - Fast setup, highly customizable

### Common Pitfalls Avoided

1. **Email Confirmation** - Handled properly with clear feedback
2. **Client vs Server** - Used appropriate Supabase clients
3. **Next.js 16 Changes** - Adapted to Turbopack, async params
4. **Type Safety** - Regenerated types after migrations
5. **File Organization** - Followed naming conventions strictly

### Best Practices Established

1. **Always use absolute imports** - `@/components` not `../../`
2. **Main function at top** - Orchestration only
3. **Document complex functions** - Input/output types
4. **Test auth flows early** - Email confirmation catches people
5. **Generate types often** - After every migration

### Future Considerations

1. **Email Templates** - Customize Supabase confirmation emails
2. **Password Reset** - Add forgot password flow
3. **OAuth Providers** - Consider Google/GitHub login
4. **Session Management** - Monitor session expiration
5. **Error Boundaries** - Better error handling in production

---

## Resources Created

### Documentation
- `/docs/learnings/learnings.md` - This file
- `/docs/rebuild-documentation.md` - Original PRD

### Migrations
- `20251222064458_initial_schema.sql` - Base schema
- `20251222071936_add_user_roles.sql` - Role system
- `20251222073836_seed.sql` - Sample data

### Pages
- `/src/app/(auth)/login/page.tsx` - Login with guest option
- `/src/app/(auth)/signup/page.tsx` - Signup with confirmation
- `/src/app/browse/page.tsx` - Protected page with banner

---

## Next Steps

Based on this session, the next logical steps are:

1. **Browse Page Implementation**
   - List series with filters
   - Search functionality
   - Pagination

2. **Series Detail Pages**
   - Dynamic routes: `/series/[slug]`
   - Chapter listing
   - Deck creation

3. **Study Mode**
   - Card flip animations
   - SRS algorithm integration
   - Progress tracking

4. **Admin Panel**
   - Series management
   - Vocabulary editing
   - User management

5. **Profile Settings**
   - Update profile info
   - Change password
   - Convert anonymous to permanent account

---

## Lessons for Future Development

### Architecture Decisions

**Why Client Components for Auth Pages:**
- Need form state management
- Browser-only Supabase auth methods
- Interactive feedback (loading states)

**Why Server Components for Browse:**
- Better performance (server-side rendering)
- SEO benefits
- No client JavaScript needed initially

**Why Route Groups:**
- Visual organization in file tree
- Clean URLs for users
- Easy to restructure later

---

## Debugging Tips

### Common Issues & Solutions

**1. "Invalid session" errors**
- Check `.env.local` has correct keys
- Verify Supabase project is linked
- Clear browser cookies

**2. RLS Policy blocks queries**
- Check if user is authenticated
- Verify policy conditions
- Use `auth.uid()` not hardcoded IDs

**3. Types out of sync**
- Run: `supabase gen types typescript --linked`
- Restart TypeScript server
- Check migration was applied

**4. Dev server won't start**
- Kill existing processes: `pkill -f "next dev"`
- Clear `.next` folder: `rm -rf .next`
- Reinstall: `rm -rf node_modules && npm install`

**5. Anonymous auth not working**
- Check Supabase dashboard settings
- Verify provider is enabled
- Check for error messages in console

---

## Conclusion

This session established:
- Complete authentication system
- Role-based access control
- Anonymous authentication
- Proper Next.js 16 patterns
- Development workflow
- Documentation standards

The foundation is now solid for building out the rest of 
the AnkiToon application following these patterns and 
conventions.

