# Admin Upload Workflow Documentation

**Purpose:** Allow admins to create chapter decks from webtoon screenshots

**Route:** `/admin`

---

## Workflow Overview

### Step 1: Series Selection

**UI Component:** `SeriesSearch`

1. Admin types series name in search field
2. System searches:
   - **Database** for existing series
   - **MAL API** for new series options
3. Results display in dropdown
4. Admin selects:
   - **Existing series** → immediately selected
   - **MAL series** → creates new series in DB, then selected

**API Endpoints:**
- `GET /api/admin/series/search?q={query}`
- `POST /api/admin/series/create-from-mal`

---

### Step 2: Chapter Number

**UI Component:** `ChapterInput`

**Enabled:** After series selected

1. Admin enters chapter number
2. System validates:
   - Must be positive integer
   - Chapter must not already exist for series
3. Real-time feedback shows:
   - Validating state
   - Error (if duplicate)
   - Success (if available)

**API Endpoint:**
- `GET /api/admin/chapter/validate?seriesId={id}&chapterNumber={num}`

---

### Step 3: Image Upload

**UI Component:** `ImageUpload`

**Enabled:** After chapter validated

1. Admin uploads webtoon screenshot via:
   - Drag and drop
   - File picker
2. Validation:
   - File type: PNG, JPG, WEBP only
   - Max size: 10MB
3. Preview displayed

---

### Step 4: Processing

**Trigger:** "Process Image" button

**Flow:**

1. Frontend sends FormData to API:
   - Image file
   - Series ID
   - Chapter number

2. API proxies to Encore OCR service:
   - Extracts Korean text from image
   - Translates to English
   - Returns vocabulary array

3. API saves to database:
   - Creates chapter record
   - Creates/updates vocabulary records
   - Links vocabulary to chapter

4. Result displayed:
   - Success: word count, link to chapter
   - Failure: error message

**API Endpoint:**
- `POST /api/admin/process-image`

---

## Database Operations (examples)

### Chapter Creation

```sql
INSERT INTO chapters (series_id, chapter_number)
VALUES ($1, $2)
RETURNING id
```

### Vocabulary Creation

```sql
INSERT INTO vocabulary (term, definition, example)
VALUES ($1, $2, $3)
ON CONFLICT (term) DO UPDATE
  SET definition = EXCLUDED.definition
RETURNING id
```

### Linking

```sql
INSERT INTO chapter_vocabulary (chapter_id, vocabulary_id)
VALUES ($1, $2)
```

---

## External Service: Encore OCR Pipeline

**Endpoint:** `${ENCORE_URL}/process-image-and-store`

**Input:** FormData with image

**Output:**
```typescript
type TranslationResult = {
  term: string        // Korean word
  definition: string  // English translation
  example: string | null  // Example sentence
}[]
```

**Processing Steps:**
1. OCR extracts Korean text from image
2. Text grouper identifies speech bubbles
3. Translation service translates to English
4. Homograph resolver handles ambiguous words

---

## Security

### Admin Check

All admin endpoints verify:

1. User is authenticated
2. User has `role = 'admin'` in profiles table

**Helper Function:**
```typescript
import { checkIsAdmin } from '@/lib/admin/auth'

const isAdmin = await checkIsAdmin(supabase, user.id)
```

### RLS Policies

Series/chapters tables need admin policies:

```sql
CREATE POLICY "Admins can insert series"
  ON series FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

---

## Error Handling

### Common Errors

1. **Chapter already exists**
   - Prevented by validation step
   - Shows error before upload

2. **OCR service unavailable**
   - Returns: "OCR service not configured"
   - Check `ENCORE_URL` env var

3. **No vocabulary extracted**
   - Returns: "No vocabulary extracted from image"
   - Image may have no Korean text

4. **Database errors**
   - Logged to console
   - Generic error returned to user

---

## Environment Variables

Required in `.env.local`:

```env
ENCORE_URL=https://your-encore-service.app

NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=xxx
```

---

## MAL API Integration

**Endpoint:** `https://api.jikan.moe/v4/manga`

**Parameters:**
- `q`: search query
- `type`: manhwa (Korean webtoons)
- `limit`: 5

**Rate Limiting:**
- 3 requests per second
- 60 requests per minute

**Data Retrieved:**
- Title (English + Japanese)
- Cover image
- Synopsis
- Popularity score
- Genres
- Authors

---

## UI States

### Series Search

- **Empty:** Shows input field
- **Typing:** Debounced search (300ms)
- **Loading:** "Searching..."
- **Results:** Dropdown with DB + MAL results
- **Selected:** Shows series card with "Change" button

### Chapter Input

- **Disabled:** Gray, unresponsive
- **Enabled:** Accepts numeric input
- **Validating:** Shows "Validating..."
- **Error:** Red text with error message
- **Valid:** Green text "Chapter N is available"

### Image Upload

- **Disabled:** Gray drop zone
- **Enabled:** Blue hover, accepts drops
- **File selected:** Shows preview + file info
- **Can remove:** "Remove" button

### Processing

- **Idle:** "Process Image" button
- **Processing:** "Processing..." disabled button
- **Success:** Green status box with stats
- **Error:** Red status box with message

---

## Testing Workflow

### Manual Test

1. Navigate to `/admin`
2. Search "Tower of God"
3. Select from results
4. Enter chapter number: 1
5. Upload test image
6. Click "Process Image"
7. Verify success message
8. Check database for records

### Database Verification

```sql
-- Check chapter created
SELECT * FROM chapters 
WHERE series_id = $series_id 
AND chapter_number = 1;

-- Check vocabulary linked
SELECT v.* 
FROM vocabulary v
JOIN chapter_vocabulary cv ON v.id = cv.vocabulary_id
WHERE cv.chapter_id = $chapter_id;
```

---

## Future Enhancements

1. **Progress Indicator**
   - Real-time OCR progress
   - Step-by-step status

2. **Retry Failed Processing**
   - Save partial results
   - Allow reprocessing

---

## Troubleshooting

### Issue: "Admin access required"

**Cause:** User logged in but not admin

**Fix:** Update user role:
```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'admin@example.com';
```

---

### Issue: "Chapter already exists"

**Cause:** Duplicate chapter number for series

**Fix:** 
- Use different chapter number
- Delete existing chapter if needed

---

### Issue: "OCR processing failed"

**Cause:** Encore service error or unavailable

**Fix:**
- Check `ENCORE_URL` is correct
- Verify Encore service is running
- Check Encore service logs

---

### Issue: "No vocabulary extracted"

**Cause:** Image has no Korean text or poor quality

**Fix:**
- Use clearer image
- Verify image contains Korean text
- Check image format (PNG works best)

---

## Related Files

### Frontend
- `/src/app/admin/page.tsx` - Main admin page
- `/src/components/admin/seriesSearch.tsx` - Series search
- `/src/components/admin/chapterInput.tsx` - Chapter input
- `/src/components/admin/imageUpload.tsx` - Image upload
- `/src/components/admin/processingStatus.tsx` - Status display

### API Routes
- `/src/app/api/admin/series/search/route.ts`
- `/src/app/api/admin/series/create-from-mal/route.ts`
- `/src/app/api/admin/chapter/validate/route.ts`
- `/src/app/api/admin/process-image/route.ts`

### Utilities
- `/src/lib/admin/auth.ts` - Admin auth helpers

---

## Summary

The admin upload workflow provides a streamlined process for creating chapter decks from webtoon screenshots. It combines database search, external API integration, OCR processing, and translation services into a simple 4-step interface.

Key features:
- Auto-complete series search
- Real-time validation
- Drag-and-drop upload
- Automated OCR + translation
- Comprehensive error handling

