'use client'

import { motion } from 'framer-motion'
import { Tables } from '@/types/database.types'
import { VocabStats } from '@/types/series.types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'

type Series = Tables<'series'>

interface SeriesHeaderProps {
  series: Series
  vocabStats: VocabStats
}

/**
 * Displays series header with cover, title, genres, authors, and stats.
 * Input: series data and vocabulary statistics
 * Output: Series header component
 */
export function SeriesHeader({ series, vocabStats }: SeriesHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
          {/* Series Cover */}
          {series.picture_url && (
            <div className="flex-shrink-0 relative w-24 h-32 sm:w-32 sm:h-44 mx-auto sm:mx-0">
              <Image
                src={series.picture_url}
                alt={series.name}
                fill
                className="rounded-lg object-cover shadow-sm"
              />
            </div>
          )}

          {/* Series Info */}
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <CardTitle className="text-xl sm:text-2xl mb-2">{series.name}</CardTitle>

            {/* Korean Name */}
            {series.korean_name && (
              <CardDescription className="text-sm sm:text-base mb-2">
                {series.korean_name}
              </CardDescription>
            )}

            {/* Alternative Names */}
            {series.alt_names && series.alt_names.length > 0 && (
              <div className="mb-3">
                <span className="text-sm font-medium text-muted-foreground">Also known as:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {series.alt_names.map((name, index) => (
                    <span
                      key={index}
                      className="text-sm bg-muted px-2 py-1 rounded-md"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Genres */}
            {series.genres && series.genres.length > 0 && (
              <div className="mb-3">
                <span className="text-sm font-medium text-muted-foreground">Genres:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {series.genres.map((genre, index) => (
                    <span
                      key={index}
                      className="text-sm bg-primary/10 text-primary px-2 py-1 rounded-md"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Authors */}
            {series.authors && series.authors.length > 0 && (
              <div className="mb-3">
                <span className="text-sm font-medium text-muted-foreground">Authors:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {series.authors.map((author, index) => (
                    <span
                      key={index}
                      className="text-sm bg-secondary px-2 py-1 rounded-md"
                    >
                      {author}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="flex flex-wrap gap-3 sm:gap-4 text-sm justify-center sm:justify-start">
              <div>
                <span className="font-medium">{series.num_chapters}</span>
                <span className="text-muted-foreground ml-1">chapters</span>
              </div>
              <div>
                <span className="font-medium">{vocabStats.totalVocabulary}</span>
                <span className="text-muted-foreground ml-1">vocabulary words</span>
              </div>
              <div>
                <span className="font-medium">{vocabStats.uniqueTerms}</span>
                <span className="text-muted-foreground ml-1">unique terms</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Synopsis */}
      {series.synopsis && (
        <CardContent>
          <div className="space-y-2">
            <h3 className="font-semibold">Synopsis</h3>
            <p className="text-muted-foreground leading-relaxed">
              {series.synopsis}
            </p>
          </div>
        </CardContent>
      )}
    </Card>
    </motion.div>
  )
}
