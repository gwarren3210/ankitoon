import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getChapterPageData } from '@/lib/series/chapterData'
import { getChapterCardCounts } from '@/lib/progress/queries/chapterProgressQueries'
import { ChapterNav } from '@/components/chapter/chapterNav'
import { ChapterHeader } from '@/components/chapter/chapterHeader'
import { VocabularyList } from '@/components/chapter/vocabularyList'
import { GuestBanner } from '@/components/auth/guestBanner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ChapterPageProps {
  params: Promise<{ slug: string; chapter: string }>
}

/**
 * Chapter detail page showing vocabulary and navigation.
 * Input: series slug and chapter number from URL params
 * Output: Server-rendered chapter page
 */
export default async function ChapterPage({ params }: ChapterPageProps) {
  const { slug, chapter: chapterParam } = await params
  const chapterNumber = parseInt(chapterParam, 10)

  if (isNaN(chapterNumber) || chapterNumber < 1) {
    notFound()
  }

  const supabase = await createClient()

  // Get authenticated user (may be anonymous)
  const { data: { user } } = await supabase.auth.getUser()

  // Single optimized query for all chapter page data
  const {
    series,
    chapter,
    prevChapter,
    nextChapter,
    vocabulary,
    chapterProgress
  } = await getChapterPageData(
    slug,
    chapterNumber,
    user?.id
  )

  if (!series || !chapter) {
    notFound()
  }

  // Fetch card counts for study/learn buttons (only for authenticated users)
  let cardCounts = { newCount: 0, dueCount: 0 }
  if (user?.id) {
    cardCounts = await getChapterCardCounts(user.id, chapter.id)
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
        {/* Guest Banner */}
        {user?.is_anonymous && <GuestBanner />}

        {/* Chapter Navigation */}
        <ChapterNav
          seriesSlug={slug}
          seriesName={series.name}
          currentChapter={chapter}
          prevChapter={prevChapter}
          nextChapter={nextChapter}
        />

        {/* Chapter Header */}
        <ChapterHeader
          seriesName={series.name}
          chapterNumber={chapter.chapter_number}
        />

        {/* Study Action Buttons */}
        {user && (
          <div className="flex flex-wrap gap-3">
            {cardCounts.newCount > 0 && (
              <Button asChild size="lg">
                <Link href={`/learn/${slug}/${chapterNumber}`}>
                  Learn New Words ({cardCounts.newCount})
                </Link>
              </Button>
            )}
            {cardCounts.dueCount > 0 && (
              <Button asChild variant="outline" size="lg">
                <Link href={`/study/${slug}/${chapterNumber}`}>
                  Study ({cardCounts.dueCount} due)
                </Link>
              </Button>
            )}
            {cardCounts.newCount === 0 && cardCounts.dueCount === 0 && (
              <Button asChild variant="outline" size="lg">
                <Link href={`/study/${slug}/${chapterNumber}`}>
                  Review Chapter
                </Link>
              </Button>
            )}
          </div>
        )}

        {/* Progress Summary (for authenticated users) */}
        { user && chapterProgress && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Cards Studied:</span>
                  <div className="font-medium">{chapterProgress.num_cards_studied}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Unique Vocab Seen:</span>
                  <div className="font-medium">{chapterProgress.unique_vocab_seen}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Accuracy:</span>
                  <div className="font-medium">
                    {chapterProgress.accuracy ? Math.round(chapterProgress.accuracy * 100) : 0}%
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div className="font-medium">
                    {chapterProgress.completed ? 'Completed' : 'In Progress'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Vocabulary List */}
        <VocabularyList vocabulary={vocabulary} />
      </div>
    </div>
  )
}
