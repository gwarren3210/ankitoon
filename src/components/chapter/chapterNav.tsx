'use client'

import { motion } from 'framer-motion'
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  seriesName,
  currentChapter,
  prevChapter,
  nextChapter
}: ChapterNavProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 p-3 sm:p-4 bg-muted/50 rounded-lg"
    >
      {/* Back to Series */}
      <Link href={`/browse/${seriesSlug}`}>
        <Button variant="ghost" size="sm" className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back to Series</span>
        </Button>
      </Link>

      {/* Chapter Navigation */}
      <div className="flex items-center gap-2 flex-1 justify-center sm:justify-start">
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

        <div className="px-2 sm:px-3 py-1 bg-background rounded border text-xs sm:text-sm font-medium truncate max-w-[200px] sm:max-w-none">
          Chapter {currentChapter.chapter_number}
          {currentChapter.title && (
            <span className="hidden sm:inline">
              {` - ${currentChapter.title}`}
            </span>
          )}
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
          className="flex justify-center sm:justify-start"
        >
          <Button variant="ghost" size="sm" className="flex items-center gap-2">
            <span className="hidden sm:inline">Read Chapter</span>
            <ExternalLink className="w-4 h-4" />
          </Button>
        </a>
      )}
    </motion.div>
  )
}
