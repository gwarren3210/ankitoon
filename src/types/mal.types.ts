/**
 * Type for MAL (MyAnimeList) series data from v4 Jikan API
 * Full response shape from /v4/manga endpoint
 */
export type MALData = {
  mal_id: number
  url: string
  images: {
    jpg: {
      image_url: string
      small_image_url: string
      large_image_url: string
    }
    webp: {
      image_url: string
      small_image_url: string
      large_image_url: string
    }
  }
  approved: boolean
  titles: Array<{
    type: string
    title: string
  }>
  title: string
  title_english: string | null
  title_japanese: string | null
  title_synonyms: string[]
  type: string
  chapters: number | null
  volumes: number | null
  status: string
  publishing: boolean
  published: {
    from: string | null
    to: string | null
    prop: {
      from: { day: number | null; month: number | null; year: number | null }
      to: { day: number | null; month: number | null; year: number | null }
    }
    string: string
  }
  score: number | null
  scored: number | null
  scored_by: number | null
  rank: number | null
  popularity: number | null
  members: number | null
  favorites: number | null
  synopsis: string
  background: string | null
  authors: Array<{
    mal_id: number
    type: string
    name: string
    url: string
  }>
  serializations: Array<{
    mal_id: number
    type: string
    name: string
    url: string
  }>
  genres: Array<{
    mal_id: number
    type: string
    name: string
    url: string
  }>
  explicit_genres: Array<{
    mal_id: number
    type: string
    name: string
    url: string
  }>
  themes: Array<{
    mal_id: number
    type: string
    name: string
    url: string
  }>
  demographics: Array<{
    mal_id: number
    type: string
    name: string
    url: string
  }>
}

