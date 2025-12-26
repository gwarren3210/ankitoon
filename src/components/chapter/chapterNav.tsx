import Link from 'next/link'
import { Tables } from '@/types/database.types'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, ExternalLink, ArrowLeft } from 'lucide-react'

type Chapter = Tables<'chapters'>

interface ChapterNavProps {
  seriesSlug: string
  seriesName: string
  currentChapter: Chapter
  prevChapter: Chapter | null
  nextChapter: Chapter | null
}

/**
 * Navigation component for chapter pages.
 * Input: series info, current chapter, adjacent chapters
 * Output: Navigation bar component
 */
export function ChapterNav({
  seriesSlug,
  seriesName,
  currentChapter,
  prevChapter,
  nextChapter
}: ChapterNavProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
      {/* Back to Series */}
      <Link href={`/browse/${seriesSlug}`}>
        <Button variant="ghost" size="sm" className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back to Series</span>
        </Button>
      </Link>

      {/* Chapter Navigation */}
      <div className="flex items-center gap-2">
        {prevChapter ? (
          <Link href={`/browse/${seriesSlug}/${prevChapter.chapter_number}`}>
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Prev</span>
            </Button>
          </Link>
        ) : (
          <Button variant="outline" size="sm" disabled className="flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Prev</span>
          </Button>
        )}

        <div className="px-3 py-1 bg-background rounded border text-sm font-medium">
          Chapter {currentChapter.chapter_number}
          {currentChapter.title && ` - ${currentChapter.title}`}
        </div>

        {nextChapter ? (
          <Link href={`/browse/${seriesSlug}/${nextChapter.chapter_number}`}>
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        ) : (
          <Button variant="outline" size="sm" disabled className="flex items-center gap-1">
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* External Link */}
      {currentChapter.external_url && (
        <a
          href={currentChapter.external_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="ghost" size="sm" className="flex items-center gap-2">
            <span className="hidden sm:inline">Read Chapter</span>
            <ExternalLink className="w-4 h-4" />
          </Button>
        </a>
      )}
    </div>
  )
}
