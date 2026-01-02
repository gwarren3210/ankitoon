'use client'

import { motion } from 'framer-motion'
import { LibraryDeck } from '@/lib/series/libraryData'
import { DeckCard } from '@/components/library/deckCard'

interface LibraryGridProps {
  decks: LibraryDeck[]
}

/**
 * Displays library decks in a responsive grid layout.
 * Input: library deck array
 * Output: Grid layout component
 */
export function LibraryGrid({ decks }: LibraryGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 
                  xl:grid-cols-4 gap-6">
      {decks.map((deck, index) => (
        <motion.div
          key={`${deck.series.id}-${deck.chapter.id}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <DeckCard deck={deck} />
        </motion.div>
      ))}
    </div>
  )
}

