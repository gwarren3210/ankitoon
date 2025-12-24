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
   - Series slug
   - Chapter number
   - Optional chapter title

2. Pipeline processing (local, no external OCR service):
   - **Upscale** (if enabled): Enhances image quality using Sharp's lanczos3 algorithm, converts to PNG
   - **Tile** (if needed): Splits large images into overlapping tiles for OCR
   - **OCR**: Extracts Korean text from image/tiles using OCR.space API
   - **Group**: Groups OCR results into dialogue lines by vertical proximity
   - **Extract**: Uses Gemini API to extract vocabulary words with translations and importance scores
   - **Store**: Saves vocabulary and chapter data to database

3. API saves to database:
   - Creates/gets chapter record
   - Creates/updates vocabulary records (deduplicates by term + sense_key)
   - Links vocabulary to chapter with importance scores

4. Result displayed:
   - Success: word count, link to chapter
   - Failure: error message

**API Endpoint:**
- `POST /api/admin/process-image`

**Pipeline Steps:**
```
Image Buffer 
  → Upscale (optional, 2x, PNG output)
  → Tile (if file size > 1MB threshold)
  → OCR (per tile or single image)
  → Group into dialogue lines
  → Extract vocabulary (Gemini)
  → Store in database
```

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

## Pipeline Processing Details

The pipeline processes images locally in Next.js (no external OCR service required).

### Processing Steps

1. **Image Upscaling** (optional, if `ENABLE_UPSCALE=1`)
   - Uses Sharp's lanczos3 algorithm for high-quality 2x upscaling
   - Converts all images to PNG (lossless) for better OCR quality
   - Improves text recognition accuracy for low-resolution images

2. **Image Tiling** (automatic for large images)
   - Splits images > 1MB into overlapping tiles
   - Prevents OCR API size limits
   - Merges results and deduplicates overlapping regions

3. **OCR Processing**
   - Uses OCR.space API to extract Korean text
   - Returns text with bounding box coordinates
   - Processes tiles in parallel with rate limiting

4. **Text Grouping**
   - Groups OCR results by vertical proximity (speech bubbles)
   - Combines words into dialogue lines
   - Uses median text height for reading order

5. **Vocabulary Extraction**
   - Uses Gemini API to extract vocabulary words
   - Returns: Korean term, English translation, importance score, sense_key
   - Filters and validates extracted words

6. **Database Storage**
   - Creates/gets chapter record
   - Batch inserts new vocabulary (deduplicates by term + sense_key)
   - Links vocabulary to chapter with importance scores

### Logging

All pipeline operations use structured logging (Pino):
- **Development**: Pretty-printed colored logs
- **Production**: JSON logs
- **Levels**: trace, debug, info, warn, error, fatal
- Set `LOG_LEVEL=debug` for detailed pipeline logs

### Debug Artifacts

When `PIPELINE_DEBUG=1`, saves intermediate files:
- `original-image.jpg` - Input image
- `upscaled-image.jpg` - Upscaled version (if enabled)
- `tiles-metadata.json` - Tile information
- `tile-{n}-ocr-raw.json` - Raw OCR API responses
- `dialogue-grouped.json` - Grouped dialogue lines
- `word-extraction-words.json` - Extracted vocabulary
- `final-result.json` - Complete pipeline result

Saved to: `src/lib/pipeline/__tests__/pipeline-artifacts/{timestamp}/`

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
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# OCR Service
OCR_API_KEY=your-ocr-space-api-key

# AI Translation
GEMINI_API_KEY=your-gemini-api-key

# Pipeline Configuration (optional)
ENABLE_UPSCALE=1              # Enable image upscaling before OCR (default: disabled)
PIPELINE_DEBUG=1              # Enable debug artifacts saving (default: disabled)
LOG_LEVEL=info                # Logging level: trace, debug, info, warn, error, fatal (default: info)
```

**Pipeline Configuration:**
- `ENABLE_UPSCALE`: Set to `1` or `true` to enable 2x image upscaling (improves OCR quality)
- `PIPELINE_DEBUG`: Set to `1` or `true` to save debug artifacts (images, JSON, text files)
- `LOG_LEVEL`: Control logging verbosity (use `debug` for detailed pipeline logs)

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

**Cause:** OCR API error or configuration issue

**Fix:**
- Check `OCR_API_KEY` is set correctly
- Verify OCR.space API is accessible
- Check pipeline logs for detailed error messages
- Set `LOG_LEVEL=debug` for more verbose logging

---

### Issue: "No vocabulary extracted"

**Cause:** Image has no Korean text or poor quality

**Fix:**
- Use clearer, higher resolution image
- Enable upscaling: Set `ENABLE_UPSCALE=1` in `.env`
- Verify image contains Korean text
- Check image format (PNG works best)
- Enable debug artifacts: Set `PIPELINE_DEBUG=1` to inspect intermediate results
- Check logs for OCR result counts: Set `LOG_LEVEL=debug`

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

### Pipeline
- `/src/lib/pipeline/orchestrator.ts` - Main pipeline orchestration
- `/src/lib/pipeline/upscale.ts` - Image upscaling
- `/src/lib/pipeline/tiling.ts` - Image tiling logic
- `/src/lib/pipeline/ocr.ts` - OCR processing
- `/src/lib/pipeline/textGrouper.ts` - Text grouping
- `/src/lib/pipeline/translator.ts` - Vocabulary extraction (Gemini)
- `/src/lib/pipeline/database.ts` - Database operations
- `/src/lib/pipeline/logger.ts` - Logging configuration
- `/src/lib/pipeline/debugArtifacts.ts` - Debug artifact saving

---

## Summary

The admin upload workflow provides a streamlined process for creating chapter decks from webtoon screenshots. It combines database search, external API integration, OCR processing, and translation services into a simple 4-step interface.

Key features:
- Auto-complete series search
- Real-time validation
- Drag-and-drop upload
- Automated OCR + translation
- Comprehensive error handling

