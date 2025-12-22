# AnkiToon API Documentation

## Table of Contents

### Authentication
- [Supabase Auth Endpoints](#authentication-endpoints)

### Series
- [GET /api/series](#get-apiseries) - List all series
- [GET /api/series/[slug]](#get-apiseriesslug) - Get series details
- [POST /api/series](#post-apiseries) - Create new series

### Chapters
- [GET /api/series/[slug]/chapters](#get-apiseriesslugchapters) - List chapters
- [GET /api/series/[slug]/chapters/[chapter_number]](#get-apiseriesslugchapterschapter_number) - Get chapter details
- [POST /api/series/[slug]/chapters](#post-apiseriesslugchapters) - Create new chapter
- [GET /api/series/[slug]/chapters/[chapter_number]/validate](#get-apiseriesslugchapterschapter_numbervalidate) - Validate chapter

### Decks
- [GET /api/decks](#get-apidecks) - List user's decks
- [GET /api/decks/[deck_id]](#get-apidecksdeck_id) - Get deck details
- [POST /api/decks](#post-apidecks) - Create new deck

### Study Sessions
- [POST /api/study/sessions](#post-apistudysessions) - Start study session
- [POST /api/study/sessions/[session_id]/rate](#post-apistudysessionssession_idrate) - Rate a card
- [POST /api/study/sessions/[session_id]/end](#post-apistudysessionssession_idend) - End session
- [GET /api/study/due](#get-apistudydue) - Get due cards

### Progress
- [GET /api/progress/stats](#get-apiprogressstats) - Overall statistics
- [GET /api/progress/activity](#get-apiprogressactivity) - Activity history
- [GET /api/progress/series](#get-apiprogressseries) - Series progress
- [GET /api/progress/chapters/[chapter_id]](#get-apiprogresschapterschapter_id) - Chapter progress

### Image Processing
- [POST /api/process/upload](#post-apiprocessupload) - Upload image
- [POST /api/process/ocr](#post-apiprocessocr) - Process OCR

### Design Principles
- [REST Conventions](#rest-conventions)
- [Optimistic UI Support](#optimistic-ui-support)
- [Security](#security)
- [Error Response Format](#error-response-format)

---

## API Reference

### Authentication Endpoints

**Handled by Supabase Auth:**

- `POST /auth/v1/signup` - Create account
- `POST /auth/v1/token?grant_type=password` - Login
- `POST /auth/v1/logout` - Logout
- `GET /auth/v1/user` - Get current user

### Series Endpoints

#### GET /api/series

List all series with optional filters.

Query params:
- `genre` - Filter by genre (string)
- `search` - Search by name (string)
- `sort` - Sort by: `popularity`, `created_at`, `name` (default: `popularity`)
- `page` - Page number (default: 1)
- `per_page` - Results per page (default: 20, max: 50)

Response:

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Tower of God",
      "korean_name": "신의 탑",
      "slug": "tower-of-god",
      "picture_url": "https://...",
      "synopsis": "...",
      "popularity": 9500,
      "genres": ["Action", "Fantasy"],
      "num_chapters": 50
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

#### GET /api/series/[slug]

Get series details with chapters and user progress.

Response:

```json
{
  "id": "uuid",
  "name": "Tower of God",
  "korean_name": "신의 탑",
  "slug": "tower-of-god",
  "picture_url": "https://...",
  "synopsis": "...",
  "genres": ["Action", "Fantasy"],
  "num_chapters": 50,
  "chapters": [
    {
      "id": "uuid",
      "chapter_number": 1,
      "title": "Chapter 1",
      "vocabulary_count": 329,
      "has_deck": true,
      "user_progress": {
        "started": true,
        "completed": false,
        "cards_studied": 45,
        "total_cards": 329,
        "accuracy": 0.78
      }
    }
  ],
  "user_series_progress": {
    "chapters_completed": 2,
    "total_chapters": 50,
    "cards_studied": 487,
    "average_accuracy": 0.82
  }
}
```

#### POST /api/series

Create new series (admin/content creator only).

Body:

```json
{
  "name": "Solo Leveling",
  "korean_name": "나 혼자만 레벨업",
  "slug": "solo-leveling",
  "picture_url": "https://...",
  "synopsis": "...",
  "genres": ["Action", "Fantasy"],
  "authors": ["Chugong"]
}
```

Response: `201 Created` with series object

### Common Field Types

Throughout the API, these field types are used consistently:

- **state** - String enum: `"new"`, `"learning"`, `"reviewing"`, `"mastered"`
- **rating** - Integer enum: `1` (Again), `2` (Hard), `3` (Good), `4` (Easy)
- **dates** - ISO 8601 timestamp strings: `"2024-01-15T10:00:00Z"` (can be `null`)
- **UUIDs** - Standard UUID v4 strings: `"123e4567-e89b-12d3-a456-426614174000"`

### Chapter Endpoints

#### GET /api/series/[slug]/chapters

List all chapters for a series.

Query params:
- `page` - Page number (default: 1)
- `per_page` - Results per page (default: 50, max: 100)
- `sort` - Sort by: `chapter_number`, `created_at` (default: `chapter_number`)
- `order` - Order: `asc`, `desc` (default: `asc`)

Response:

```json
{
  "series_id": "uuid",
  "series_name": "Tower of God",
  "chapters": [
    {
      "id": "uuid",
      "chapter_number": 1,
      "vocabulary_count": 329,
      "has_deck": true
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total": 150,
    "total_pages": 3
  }
}
```

#### GET /api/series/[slug]/chapters/[chapter_number]

Get chapter details with vocabulary preview.

Query params:
- `limit` - Number of vocabulary words to return (default: 25)
- `offset` - Pagination offset (default: 0)

Response:

```json
{
  "id": "uuid",
  "series_id": "uuid",
  "series_name": "Tower of God",
  "series_slug": "tower-of-god",
  "chapter_number": 1,
  "title": "Chapter 1",
  "vocabulary": [
    {
      "id": "uuid",
      "term": "탑",
      "definition": "tower",
      "example": "그는 탑에 올라갔다",
      "importance_score": 85
    }
  ],
  "pagination": {
    "limit": 25,
    "offset": 0,
    "total": 329
  }
}
```

#### POST /api/series/[slug]/chapters

Create new chapter with vocabulary (via image processing). (admin/content creator only).

Body:

```json
{
  "chapter_number": 15,
  "title": "Chapter 15",
  "image_url": "https://storage.../image.jpg"
}
```

Response: `201 Created` with chapter object and processing status

#### GET /api/series/[slug]/chapters/[chapter_number]/validate

Check if chapter already exists.

Response:

```json
{
  "exists": false,
  "chapter_id": null
}
```

### Deck Endpoints

#### GET /api/decks

List user's personal decks.

Query params:
- `series_id` - Filter by series (uuid)
- `sort` - Sort by: `created_at`, `updated_at`, `name` (default: `updated_at`)
- `page` - Page number (default: 1)
- `per_page` - Results per page (default: 20)

Response:

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Tower of God - Chapter 1",
      "user_id": "uuid",
      "chapter_id": "uuid",
      "series_name": "Tower of God",
      "series_slug": "tower-of-god",
      "chapter_number": 1,
      "vocabulary_count": 329,
      "cards_new": 100,
      "cards_learning": 150,
      "cards_reviewing": 70,
      "cards_mastered": 9,
      "cards_due": 23,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-15T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 15
  }
}
```

#### GET /api/decks/[deck_id]

Get deck details with card preview.

Query params:
- `limit` - Number of cards to preview (default: 25)
- `offset` - Pagination offset (default: 0)

Response:

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "chapter_id": "uuid",
  "series_name": "Tower of God",
  "series_slug": "tower-of-god",
  "chapter_number": 1,
  "vocabulary_count": 329,
  "cards_new": 100,
  "cards_learning": 150,
  "cards_reviewing": 70,
  "cards_mastered": 9,
  "cards_due": 23,
  "cards": [
    {
      "id": "uuid",
      "vocabulary_id": "uuid",
      "term": "탑",
      "definition": "tower",
      "example": "그는 탑에 올라갔다",
      "state": "learning",
      "next_review_date": "2024-01-16T10:00:00Z",
      "ease_factor": 2.5,
      "review_interval_days": 1
    }
  ],
  "pagination": {
    "limit": 25,
    "offset": 0,
    "total": 329
  }
}
```

#### POST /api/decks

Create new deck from chapter.

Body:

```json
{
  "chapter_id": "uuid"
}
```

Response: `204 No Content`

### Study Session Endpoints

#### POST /api/study/sessions

Start new study session for a deck.

Body:

```json
{
  "deck_id": "uuid",
  "max_new_cards": 20,
  "max_review_cards": 50
}
```

Response:

```json
{
  "session_id": "uuid",
  "deck_id": "uuid",
  "cards": [
    {
      "id": "uuid",
      "srs_card_id": "uuid",
      "vocabulary_id": "uuid",
      "term": "탑",
      "definition": "tower",
      "example": "그는 탑에 올라갔다",
      "state": "new",
      "current_interval_days": 0,
      "ease_factor": 2.5
    }
  ],
  "state_stats": {
    "new": 20,
    "learning": 15,
    "reviewing": 10,
    "total": 45
  },
  "started_at": "2024-01-15T10:00:00Z"
}
```

#### POST /api/study/sessions/[session_id]/rate

Rate a card in the current session.

Body:

```json
{
  "srs_card_id": "uuid",
  "rating": 3,
  "time_taken_ms": 3500
}
```

Body fields:
- `srs_card_id` - UUID of the SRS card being rated
- `rating` - Integer enum: `1` (Again), `2` (Hard), `3` (Good), `4` (Easy)
- `time_taken_ms` - Time in milliseconds to answer the card

Response:

```json
{
  "success": true,
  "updated_card": {
    "id": "uuid",
    "state": "learning",
    "next_review_date": "2024-01-16T10:00:00Z",
    "review_interval_days": 1,
    "ease_factor": 2.5
  },
}
```

Response fields:
- `updated_card.state` - String enum: `"new"`, `"learning"`, `"reviewing"`, `"mastered"`
- `updated_card.next_review_date` - ISO 8601 timestamp or `null`

#### POST /api/study/sessions/[session_id]/end

End study session and get summary.

Response:

```json
{
  "session_id": "uuid",
  "summary": {
    "cards_reviewed": 25,
    "time_spent_ms": 780000,
    "average_rating": 2.8,
    "ratings_breakdown": {
      "again": 2,
      "hard": 8,
      "good": 12,
      "easy": 3
    },
    "state_changes": {
      "new_to_learning": 15,
      "learning_to_reviewing": 5,
      "reviewing_to_mastered": 2
    }
  },
  "next_review": {
    "cards_due_today": 8,
    "cards_due_tomorrow": 7,
    "next_due_date": "2024-01-16T00:00:00Z"
  },
  "deck_stats": {
    "cards_new": 80,
    "cards_learning": 160,
    "cards_reviewing": 75,
    "cards_mastered": 14
  }
}
```

#### GET /api/study/due

Get all cards due for review across all decks.

Query params:
- `deck_id` - Filter by specific deck (optional)
- `date` - Get cards due by specific date (default: today)

Response:

```json
{
  "due_today": 32,
  "due_this_week": 87,
  "estimated_time_minutes": 12,
  "decks": [
    {
      "deck_id": "uuid",
      "series_name": "Tower of God",
      "chapter_number": 1,
      "cards_due": 15,
      "estimated_time_minutes": 6
    }
  ]
}
```

### Progress Endpoints

#### GET /api/progress/stats

Get current user's overall statistics.

Response:

```json
{
  "vocabulary": {
    "total": 487,
    "new": 100,
    "learning": 184,
    "reviewing": 150,
    "mastered": 53
  },
  "streaks": {
    "current": 15,
    "longest": 28
  },
  "study_time": {
    "total_seconds": 18000,
    "today_seconds": 1200,
    "this_week_seconds": 5400,
    "average_daily_seconds": 771
  },
  "accuracy": {
    "overall": 0.82,
    "last_7_days": 0.85,
    "last_30_days": 0.81
  },
  "reviews": {
    "total": 2543,
    "today": 32,
    "this_week": 187
  },
  "cards_due_today": 32
}
```

#### GET /api/progress/activity

Get study activity history.

Query params:
- `days` - Number of days to retrieve (default: 30, max: 365)
- `granularity` - `day` or `week` (default: `day`)
- `page` - Page number (default: 1)
- `per_page` - Results per page (default: 30, max: 100)

Response:

```json
{
  "activity": [
    {
      "date": "2024-01-15",
      "cards_reviewed": 45,
      "time_spent_seconds": 1200,
      "average_rating": 2.8,
      "sessions": 2
    },
    {
      "date": "2024-01-14",
      "cards_reviewed": 38,
      "time_spent_seconds": 980,
      "average_rating": 2.9,
      "sessions": 1
    }
  ],
  "summary": {
    "total_days": 365,
    "days_studied": 287,
    "consistency_rate": 0.79
  },
  "pagination": {
    "page": 1,
    "per_page": 30,
    "total": 365,
    "total_pages": 13
  }
}
```

#### GET /api/progress/series

Get progress breakdown by series.

Query params:
- `sort` - Sort by: `last_studied`, `cards_studied`, `time_spent` (default: `last_studied`)
- `page` - Page number (default: 1)
- `per_page` - Results per page (default: 10, max: 50)

Response:

```json
{
  "series": [
    {
      "series_id": "uuid",
      "series_name": "Tower of God",
      "series_slug": "tower-of-god",
      "chapters_completed": 3,
      "total_chapters": 50,
      "cards_studied": 487,
      "total_cards": 2500,
      "average_accuracy": 0.82,
      "total_time_seconds": 12000,
      "last_studied": "2024-01-15T10:00:00Z",
      "current_streak": 7
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 10,
    "total": 25,
    "total_pages": 3
  }
}
```

#### GET /api/progress/chapters/[chapter_id]

Get detailed progress for specific chapter.

Response:

```json
{
  "chapter_id": "uuid",
  "series_name": "Tower of God",
  "series_slug": "tower-of-god",
  "chapter_number": 1,
  "progress": {
    "cards_studied": 329,
    "total_cards": 329,
    "completion_rate": 1.0,
    "accuracy": 0.84,
    "time_spent_seconds": 4200,
    "last_studied": "2024-01-15T10:00:00Z",
    "first_studied": "2024-01-01T10:00:00Z",
    "current_streak": 7,
    "is_completed": true
  },
  "card_distribution": {
    "new": 0,
    "learning": 50,
    "reviewing": 250,
    "mastered": 29
  },
  "recent_sessions": [
    {
      "session_id": "uuid",
      "studied_at": "2024-01-15T10:00:00Z",
      "cards_reviewed": 25,
      "time_spent_seconds": 780,
      "average_rating": 2.8
    }
  ]
}
```

### Image Processing Endpoints

#### POST /api/process/upload

Upload webtoon image to Supabase Storage.

Body: `multipart/form-data` with `image` field

Response:

```json
{
  "file_url": "https://storage.supabase.co/.../image.jpg",
  "file_id": "uuid"
}
```

---

## API Design Principles

### REST Conventions

1. **Resource Conventions**
   - Use slugs for public resources (series), UUIDs for user resources (decks)

2. **Status Codes**
   - `200 OK` - Successful GET/PATCH
   - `201 Created` - Successful POST
   - `204 No Content` - Successful DELETE or async update
   - `400 Bad Request` - Invalid request data
   - `401 Unauthorized` - Missing or invalid auth
   - `403 Forbidden` - Authenticated but not authorized
   - `404 Not Found` - Resource doesn't exist
   - `500 Internal Server Error` - Server error

4. **Pagination**
   - Always paginate list endpoints
   - Include pagination metadata in response
   - Default: 20 items per page, max: 50

5. **Filtering & Sorting**
   - Use query params for filters
   - Common params: `sort`, `search`, `limit`, `offset`
   - Document available filters per endpoint

### Optimistic UI Support

Key endpoints designed for optimistic updates:

1. **Study Rating** (`POST /api/study/sessions/[id]/rate`)
   - Returns updated card state immediately
   - Client can show next card before DB confirms
   - Batch endpoint available for background sync

2. **Session Queue**
   - All cards sent at session start
   - Client manages queue locally
   - Server only tracks ratings/progress

3. **Progress Stats**
   - Real-time subscriptions via Supabase Realtime
   - Stats updated asynchronously after ratings

### Security

1. **Authentication**
   - All endpoints require Supabase auth (except public series browsing)
   - Row Level Security (RLS) enforces user data isolation

2. **Authorization**
   - Users can only access their own decks/progress
   - Series/chapters are public read
   - Admin-only endpoints for content creation

3. **Rate Limiting**
   - Out of scope

### Error Response Format

All errors follow consistent format:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Deck with ID 'xyz' not found",
    "details": {
      "resource": "deck",
      "id": "xyz"
    }
  }
}
```

Common error codes:
- `UNAUTHORIZED` - Missing/invalid auth
- `FORBIDDEN` - Not allowed to access resource
- `RESOURCE_NOT_FOUND` - Resource doesn't exist
- `VALIDATION_ERROR` - Invalid request data
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `PROCESSING_ERROR` - OCR/translation failed