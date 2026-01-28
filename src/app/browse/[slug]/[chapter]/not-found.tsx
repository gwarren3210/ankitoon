import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

interface ChapterNotFoundProps {
  params?: Promise<{ slug: string }>
}

/**
 * 404 page for invalid chapter numbers.
 * Features 또리 the tiger mascot.
 */
export default async function ChapterNotFound({
  params,
}: ChapterNotFoundProps) {
  const slug = params ? (await params).slug : null

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-sm flex flex-col items-center text-center">
        {/* 또리 illustration */}
        <Image
          src="/ttori/empty-error.png"
          alt="Ttori bowing apologetically"
          width={180}
          height={180}
          className="mb-6"
          priority
        />

        <h1 className="text-xl font-semibold mb-2">Chapter Not Found</h1>

        <p className="text-muted-foreground text-sm mb-6">
          The chapter you&apos;re looking for doesn&apos;t exist or hasn&apos;t
          been processed yet.
        </p>

        <div className="flex gap-3">
          {slug ? (
            <Button variant="outline" asChild>
              <Link href={`/browse/${slug}`}>Back to Series</Link>
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <Link href="/browse">Browse Series</Link>
            </Button>
          )}
          <Button asChild>
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
