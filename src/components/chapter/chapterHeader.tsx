'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface ChapterHeaderProps {
  seriesName: string
  chapterNumber: number
  chapterTitle?: string | null
  seriesSlug: string
}

/**
 * Animated chapter header section.
 * Input: series name, chapter number, optional title, series slug
 * Output: Animated chapter header component
 */
export function ChapterHeader({
  seriesName,
  chapterNumber,
  chapterTitle,
  seriesSlug
}: ChapterHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center space-y-4"
    >
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">
          {seriesName} - Chapter {chapterNumber}
        </h1>
      </div>
    </motion.div>
  )
}

