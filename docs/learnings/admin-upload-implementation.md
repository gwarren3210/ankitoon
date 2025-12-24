# Admin Upload Implementation

**Date:** December 22, 2025
**Feature:** Admin deck creation from webtoon screenshots

---

## What Was Built

### Frontend Components

Created `/src/components/admin/`:
- **seriesSearch.tsx** - Auto-complete search with DB + MAL
- **chapterInput.tsx** - Real-time chapter validation
- **imageUpload.tsx** - Drag-drop file upload
- **processingStatus.tsx** - Success/error display

Created `/src/app/admin/page.tsx`:
- Main admin page orchestrating all components
- Multi-step form with conditional enabling
- State management for workflow

### API Routes

Created `/src/app/api/admin/`:

**Series Management:**
- `series/search/route.ts` - Search DB and MAL API
- `series/create-from-mal/route.ts` - Create from MAL data

**Chapter Management:**
- `chapter/validate/route.ts` - Check chapter availability

**Processing:**
- `process-image/route.ts` - OCR + Translation pipeline

### Utilities

Created `/src/lib/admin/auth.ts`:
- `checkIsAdmin()` - Verify admin role
- `requireAdmin()` - Throw if not admin

---

## Workflow

1. **Series Selection**
   - Search by name
   - Select existing or create from MAL
   - Real-time dropdown with results

2. **Chapter Input**
   - Enter chapter number
   - Validates uniqueness
   - Enables only after series selected

3. **Image Upload**
   - Drag-drop or click to upload
   - PNG/JPG/WEBP only, max 10MB
   - Shows preview
   - Enables only after chapter validated

4. **Processing**
   - Sends to Encore OCR service
   - Creates chapter + vocabulary in DB
   - Links vocabulary to chapter
   - Shows success with word count

---

## Key Design Decisions

### Progressive Enhancement

Form fields enable sequentially:
- Series → Chapter → Upload → Process
- Prevents invalid state combinations
- Clear visual feedback

### Real-time Validation

- Series search: 300ms debounce
- Chapter validation: 500ms debounce
- Immediate feedback to user

### Error Handling

- Admin check on all endpoints
- Client-side file validation
- Server-side duplicate detection
- Graceful API failure messages

### Code Organization

- Single responsibility components
- Reusable admin auth helper
- Documented functions with I/O types
- Main function orchestrates, helpers implement

---

## External Integrations

### MyAnimeList (Jikan API)

**Endpoint:** `https://api.jikan.moe/v4/manga`

**Why:** Auto-populate series metadata
- Cover images
- Synopsis
- Genres/authors
- Popularity

**Rate Limit:** 3 req/sec, 60 req/min

### Encore OCR Pipeline

**Endpoint:** `${ENCORE_URL}/process-image-and-store`

**Processing:**
1. OCR extracts Korean text
2. Text grouper identifies dialogue
3. Translation to English
4. Homograph resolution (coming soon)

**Output:** New and total word counts as well as the series slug and chapter number

---

## Database Schema Usage

### Tables Modified

**series:**
- Created from MAL data
- Fields: name, korean_name, alt_names, slug, etc.

**chapters:**
- Created with series_id + chapter_number
- Unique constraint prevents duplicates

**vocabulary:**
- Skips if exact term and definition match
- Indexed by term for fast lookup

**chapter_vocabulary:**
- Links vocabulary to chapters
- Many-to-many relationship

---

## Security

### Admin Role Enforcement

All endpoints check:
```typescript
const { data: { user } } = await supabase.auth.getUser()
if (!user) return 401

const isAdmin = await checkIsAdmin(supabase, user.id)
if (!isAdmin) return 403
```

### RLS Policies Needed

Add to migrations:
```sql
CREATE POLICY "Admins can insert series"
  ON series FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert chapters"
  ON chapters FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

---

## Testing Checklist

### Unit Tests Needed

- [ ] Series slug generation
- [ ] File type validation
- [ ] Chapter number parsing
- [ ] Admin role check

### Integration Tests Needed

- [ ] Full upload workflow
- [ ] MAL API fallback
- [ ] Duplicate chapter handling
- [ ] OCR service failure

### Manual Testing

- [x] Series search (DB)
- [x] Series search (MAL)
- [x] Chapter validation
- [x] Image upload
- [ ] Process image (requires Encore)

---

## Environment Setup

Required variables:

```env
# Encore OCR service
ENCORE_URL=https://your-encore-service.app

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=xxx
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=xxx
```

---

## Next Steps

### Immediate

1. **Add RLS policies** for admin insert
2. **Test with Encore service** once deployed
3. **Create first admin user:**
   ```sql
   UPDATE profiles 
   SET role = 'admin' 
   WHERE email = 'admin@example.com';
   ```

### Future Enhancements

1. **Progress indicator** - Real-time OCR status
2. **Retry logic** - Reprocess failed uploads

---

## Files Created

### Frontend
```
src/
├── app/
│   └── admin/
│       └── page.tsx
├── components/
│   └── admin/
│       ├── seriesSearch.tsx
│       ├── chapterInput.tsx
│       ├── imageUpload.tsx
│       └── processingStatus.tsx
```

### Backend
```
src/
├── app/
│   └── api/
│       └── admin/
│           ├── series/
│           │   ├── search/
│           │   │   └── route.ts
│           │   └── create-from-mal/
│           │       └── route.ts
│           ├── chapter/
│           │   └── validate/
│           │       └── route.ts
│           └── process-image/
│               └── route.ts
└── lib/
    └── admin/
        └── auth.ts
```

### Documentation
```
docs/
├── admin-workflow.md
└── learnings/
    └── admin-upload-implementation.md
```

---

## Learnings

### What Worked Well

1. **Centralized admin check** - DRY principle
2. **Component separation** - Easy to maintain

### Challenges Solved

1. **MAL API integration** - Jikan v4 format
2. **File validation** - Client + server side
3. **Debounced search** - Smooth performance
4. **State management** - Sequential enables

### Code Quality

- All functions documented
- TypeScript types throughout
- No linter errors
- Follows project conventions

---

## Related Documentation

- [Admin Workflow](../admin-workflow.md) - Detailed workflow
- [Rebuild Documentation](../rebuild-documentation.md) - PRD
- [API Documentation](../api-documentation.md) - API specs
- [Main Learnings](./learnings.md) - Project learnings

---

## Summary

Successfully implemented complete admin upload pipeline:
- 5 React components
- 4 API routes
- MAL API integration
- Encore OCR integration
- Admin authentication
- Comprehensive documentation

Ready for testing once Encore service is deployed and admin RLS policies are added.

