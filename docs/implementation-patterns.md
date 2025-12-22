# AnkiToon Implementation Patterns

Best practices and code patterns for building AnkiToon with Next.js 14+ and Supabase.

## Table of Contents

1. [Optimistic UI for Study Flow](#1-optimistic-ui-for-study-flow)
2. [Server Components for Data Fetching](#2-server-components-for-data-fetching)
3. [API Route Structure](#3-api-route-structure)
4. [Realtime Progress Updates](#4-realtime-progress-updates)
5. [Image Upload with Progress](#5-image-upload-with-progress)

---

## 1. Optimistic UI for Study Flow

**Problem:** Database writes are slow (~200ms), interrupting study flow.

**Solution:** Optimistic updates with background sync.
Sends to server in small batches, server writes to database in batches

```typescript
// app/study/[deckId]/StudySession.tsx
// TODO get code from prior implementation

'use client'

import { useState, useCallback } from 'react'
import { FSRSRating, StudyCard, SessionQueues } from '@/types'

export function StudySession({ initialSession }: Props) {
  const [currentCard, setCurrentCard] = useState<StudyCard>(initialSession.currentCard)
  const [queues, setQueues] = useState<SessionQueues>(initialSession.queues)
  const [pendingUpdates, setPendingUpdates] = useState<Array<{ cardId: string, rating: number }>>([])
  
  // Get next card from queues (client-side)
  const getNextCard = useCallback(() => {
    if (queues.length > 0) return queue.shift()
    return null
  }, [queue])
  
  // Handle rating - OPTIMISTIC UPDATE
  const handleRating = async (rating: FSRSRating) => {
    const ratedCard = currentCard
    
    // 1. Immediately show next card (instant UI update)
    const nextCard = getNextCard()
    setCurrentCard(nextCard)
    
    // 2. Update progress in background (non-blocking)
    updateProgressAsync(ratedCard.id, rating)
    
    // 3. Add to pending updates (for batch flush)
    setPendingUpdates(prev => [...prev, { cardId: ratedCard.id, rating }])
    
    // 4. Batch flush every 5 cards
    if (pendingUpdates.length >= 5) {
      flushProgressBatch()
    }
  }
  
  // Async update (fire and forget)
  const updateProgressAsync = async (cardId: string, rating: number) => {
    try {
      await fetch('/api/study/progress/update', {
        method: 'POST',
        body: JSON.stringify({ cardId, rating }),
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (err) {
      // Queue for retry
      console.error('Progress update failed, will retry on session end', err)
    }
  }
  
  // Batch flush (every 5 cards or on session end)
  const flushProgressBatch = async () => {
    if (pendingUpdates.length === 0) return
    
    try {
      await fetch('/api/study/progress/batch', {
        method: 'POST',
        body: JSON.stringify({ updates: pendingUpdates }),
        headers: { 'Content-Type': 'application/json' }
      })
      setPendingUpdates([])
    } catch (err) {
      console.error('Batch flush failed', err)
      // Keep pending, will retry on session end
    }
  }
  
  // On session end, flush all remaining
  const endSession = async () => {
    await flushProgressBatch()
    await fetch('/api/study/session/end', {
      method: 'POST',
      body: JSON.stringify({ sessionId: initialSession.id }),
      headers: { 'Content-Type': 'application/json' }
    })
    // Show summary...
  }
  
  return (
    <div>
      <StudyCard card={currentCard} onRate={handleRating} />
      {/* Progress UI */}
    </div>
  )
}
```

**Benefits:**
- Instant UI feedback (< 16ms)
- No waiting for database writes
- Batch updates reduce API calls
- Graceful error handling with retry

---

## 2. Server Components for Data Fetching

Use React Server Components for initial data loads.
**note** don't use rpc here
```typescript
// app/browse/page.tsx (Server Component)

import { createServerClient } from '@/lib/supabase'
import { SeriesCard } from '@/components/SeriesCard'

export default async function BrowsePage() {
  const supabase = await createServerClient()
  
  // Fetch on server, no loading state needed
  const { data: series } = await supabase
    .from('series')
    .select('*')
    .order('popularity', { ascending: false })
    .limit(20)
  
  return (
    <div className="grid grid-cols-3 gap-4">
      {series?.map(s => (
        <SeriesCard key={s.id} series={s} />
      ))}
    </div>
  )
}
```

---

## 3. API Route Structure

Consistent API route pattern:

```typescript
// app/api/study/sessions/route.ts

import { createServerClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createServerClient()
  
  // 1. Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // 2. Parse request body
  const { deck_id, max_new_cards, max_review_cards } = await request.json()
  
  // 3. Load deck cards with progress
  const { data: cards, error } = await supabase
    .rpc('get_deck_cards_with_progress', { 
      p_user_id: user.id,
      p_deck_id: deck_id,
      p_max_new: max_new_cards || 20,
      p_max_review: max_review_cards || 50
    })
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  // 4. Build session queues by state
  const session = buildSession(cards, user.id, deck_id)
  
  // 5. Return session data
  return NextResponse.json(session)
}
```

---

## 4. Realtime Progress Updates

Use Supabase Realtime for live progress sync.
**note** this pattern is correct but use it for the agg stats tables 
`user_chapter_progress_summary`, `user_series_progress_summary`, etc.

```typescript
// hooks/useStudyProgress.ts

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { UserStats } from '@/types'

export function useStudyProgress(userId: string) {
  const [stats, setStats] = useState<UserStats | null>(null)
  const supabase = createClient()
  
  useEffect(() => {
    // Subscribe to progress summary updates
    const channel = supabase
      .channel('user-progress')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_chapter_progress_summary',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          // Refresh stats on progress update
          fetchStats()
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])
  
  const fetchStats = async () => {
    const { data } = await supabase
      .rpc('get_user_stats', { p_user_id: userId })
    setStats(data)
  }
  
  return { stats, refresh: fetchStats }
}
```

---

## 5. Image Upload with Progress

```typescript
// components/ImageUploader.tsx

'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export function ImageUploader({ onUploadComplete }: Props) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const supabase = createClient()
  
  const handleUpload = async (file: File) => {
    setUploading(true)
    
    // 1. Upload to Supabase Storage
    const fileName = `${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage
      .from('webtoon-images')
      .upload(`uploads/${fileName}`, file, {
        cacheControl: '3600',
        upsert: false,
        // Track progress
        // Note: might not actually track progress
        onUploadProgress: (progress) => {
          setProgress((progress.loaded / progress.total) * 100)
        }
      })
    
    if (error) {
      console.error('Upload failed:', error)
      return
    }
    
    // 2. Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('webtoon-images')
      .getPublicUrl(`uploads/${fileName}`)
    
    setUploading(false)
    onUploadComplete(publicUrl)
  }
  
  return (
    <div>
      {/* Drag-drop UI */}
      {uploading && <ProgressBar value={progress} />}
    </div>
  )
}
```

