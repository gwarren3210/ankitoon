import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSeriesBySlug } from '@/lib/series/seriesData'
import { getChapterByNumber } from '@/lib/series/chapterData'
import { StudySession } from '@/components/study/studySession'
import { GuestBanner } from '@/components/auth/guestBanner'
import { logger } from '@/lib/logger'

interface StudyPageProps {
  params: Promise<{ slug: string; chapter: string }>
}

/**
 * Study page for flashcards in a specific chapter.
 * Input: series slug and chapter number from URL params
 * Output: Server-rendered study page with initial card data
 */
export default async function StudyPage({ params }: StudyPageProps) {
  const { slug, chapter: chapterParam } = await params
  const chapterNumber = parseInt(chapterParam, 10)

  if (isNaN(chapterNumber) || chapterNumber < 1) {
    logger.warn({ slug, chapterParam }, 'Invalid chapter number in study page')
    notFound()
  }

  const supabase = await createClient()

  // Get authenticated user (may be anonymous)
  const { data: { user } } = await supabase.auth.getUser()

  logger.info({
    slug,
    chapterNumber,
    userId: user?.id,
    isAnonymous: user?.is_anonymous ?? false
  }, 'Study page accessed')

  // Fetch series data
  const series = await getSeriesBySlug(slug)
  if (!series) {
    logger.warn({ slug, chapterNumber, userId: user?.id }, 'Series not found in study page')
    notFound()
  }

  // Fetch chapter data
  const chapter = await getChapterByNumber(series.id, chapterNumber)
  if (!chapter) {
    logger.warn({
      slug,
      chapterNumber,
      seriesId: series.id,
      userId: user?.id
    }, 'Chapter not found in study page')
    notFound()
  }

  logger.info({
    slug,
    chapterNumber,
    seriesId: series.id,
    chapterId: chapter.id,
    userId: user?.id,
  }, 'Study page loaded successfully')


  return (
    <div className="h-full overflow-hidden bg-background flex flex-col" style={{ overscrollBehavior: 'none' }}>
      <div className="flex-1 overflow-y-auto p-4 sm:p-8" style={{ overscrollBehavior: 'contain' }}>
        <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
          {/* Guest Banner */}
          {user?.is_anonymous && <GuestBanner />}

          {/* Study Header */}
          <div className="text-center">
            <h1 className="text-xl sm:text-2xl font-bold">
              Study: {series.name} - Chapter {chapter.chapter_number}
            </h1>
            {chapter.title && (
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">{chapter.title}</p>
            )}
          </div>

          {/* Study Session */}
          <StudySession
            seriesSlug={slug}
            seriesName={series.name}
            chapter={chapter}
          />

        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="flex justify-center gap-4 pt-4 sm:pt-6 border-t pb-4">
        <a
          href={`/browse/${slug}/${chapterNumber}`}
          className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Chapter
        </a>
        <a
          href={`/browse/${slug}`}
          className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Series
        </a>
        <a
          href="/library"
          className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Library
        </a>
      </div>
    </div>
  )
}
