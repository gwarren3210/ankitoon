'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { MALData } from '@/types/mal.types'
import Image from 'next/image'

type Series = {
  id: string
  name: string
  slug: string
  picture_url: string | null
}

type Props = {
  onSeriesSelected: (series: Series | null) => void
  selectedSeries: Series | null
}

/**
 * SeriesSearch component
 * Searches DB for existing series or fetches from MAL API
 * Input: search query string
 * Output: calls onSeriesSelected with Series object
 */
export function SeriesSearch({ 
  onSeriesSelected, 
  selectedSeries 
}: Props) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [dbResults, setDbResults] = useState<Series[]>([])
  const [malResults, setMalResults] = useState<MALData[]>([])
  const [showResults, setShowResults] = useState(false)
  const [creating, setCreating] = useState(false)

  const searchSeries = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setDbResults([])
      setMalResults([])
      setShowResults(false)
      return
    }

    setSearching(true)
    setShowResults(true)

    const response = await fetch(
      `/api/admin/series/search?q=${
        encodeURIComponent(searchQuery)
      }`
    )
    const data = await response.json()

    setDbResults(data.dbResults || [])
    setMalResults(data.malResults || [])
    setSearching(false)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      searchSeries(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const handleSelectExisting = (series: Series) => {
    onSeriesSelected(series)
    setShowResults(false)
    setQuery(series.name)
  }

  const handleCreateFromMAL = async (malSeries: MALData) => {
    setCreating(true)

    const response = await fetch(
      '/api/admin/series/create-from-mal',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ malData: malSeries }),
      }
    )

    const data = await response.json()

    if (data.success && data.series) {
      onSeriesSelected(data.series)
      setQuery(data.series.name)
      setShowResults(false)
    }

    setCreating(false)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="series-search">
        Series Name
      </Label>
      
      {selectedSeries ? (
        <div className="flex items-center gap-2 p-3 
          border rounded-md bg-muted">
          {selectedSeries.picture_url && (
            <Image
              src={selectedSeries.picture_url}
              alt={selectedSeries.name}
              className="w-12 h-16 object-cover rounded"
            />
          )}
          <div className="flex-1">
            <p className="font-medium">
              {selectedSeries.name}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onSeriesSelected(null)
              setQuery('')
            }}
          >
            Change
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Input
            id="series-search"
            placeholder="Search or enter new series..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {showResults && (
            <div className="absolute z-10 w-full mt-1 
              bg-background border rounded-md shadow-lg 
              max-h-96 overflow-y-auto">
              {searching ? (
                <div className="p-4 text-center 
                  text-muted-foreground">
                  Searching...
                </div>
              ) : (
                <>
                  {dbResults.length > 0 && (
                    <div className="border-b">
                      <div className="p-2 text-xs font-semibold 
                        text-muted-foreground">
                        Existing Series
                      </div>
                      {dbResults.map((series) => (
                        <button
                          key={series.id}
                          onClick={() => 
                            handleSelectExisting(series)
                          }
                          className="w-full p-3 
                            hover:bg-muted 
                            flex items-center gap-2 
                            text-left"
                        >
                          {series.picture_url && (
                            <Image
                              src={series.picture_url}
                              alt={series.name}
                              className="w-10 h-14 object-cover 
                                rounded"
                            />
                          )}
                          <span>{series.name}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {malResults.length > 0 && (
                    <div>
                      <div className="p-2 text-xs font-semibold 
                        text-muted-foreground">
                        Create from MAL
                      </div>
                      {malResults.map((series) => (
                        <button
                          key={series.mal_id}
                          onClick={() => 
                            handleCreateFromMAL(series)
                          }
                          disabled={creating}
                          className="w-full p-3 
                            hover:bg-muted 
                            flex items-center gap-2 
                            text-left disabled:opacity-50"
                        >
                          <Image
                            src={series.images.jpg.image_url}
                            alt={series.title}
                            className="w-10 h-14 object-cover 
                              rounded"
                          />
                          <div className="flex-1">
                            <p className="font-medium">
                              {series.title}
                            </p>
                            {series.title_english && (
                              <p className="text-sm 
                                text-muted-foreground">
                                {series.title_english}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {!searching && dbResults.length === 0 && 
                   malResults.length === 0 && (
                    <div className="p-4 text-center 
                      text-muted-foreground">
                      No results found
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

