import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

/**
 * Root-level 404 page for invalid routes.
 * Features 또리 the tiger mascot.
 */
export default function NotFound() {
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

        <h1 className="text-xl font-semibold mb-2">Page Not Found</h1>

        <p className="text-muted-foreground text-sm mb-6">
          The page you&apos;re looking for doesn&apos;t exist or may have
          been moved.
        </p>

        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/browse">Browse Series</Link>
          </Button>
          <Button asChild>
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
