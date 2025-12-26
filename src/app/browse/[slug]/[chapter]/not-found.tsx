import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ChapterNotFoundProps {
  params?: Promise<{ slug: string }>
}

/**
 * 404 page for invalid chapter numbers.
 * Input: series slug from params (optional)
 * Output: 404 error page
 */
export default async function ChapterNotFound({ 
  params 
}: ChapterNotFoundProps) {
  const slug = params ? (await params).slug : null

  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Chapter Not Found</CardTitle>
            <CardDescription>
              The chapter you&apos;re looking for doesn&apos;t exist for 
              this series.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This could happen if:
            </p>
            <ul className="text-sm text-muted-foreground list-disc 
                          list-inside space-y-1">
              <li>The chapter number is invalid</li>
              <li>The chapter hasn&apos;t been processed yet</li>
              <li>The chapter was removed</li>
            </ul>

            <div className="flex gap-2 pt-4">
              {slug ? (
                <Link href={`/browse/${slug}`}>
                  <Button variant="outline">Back to Series</Button>
                </Link>
              ) : (
                <Link href="/browse">
                  <Button variant="outline">Browse Series</Button>
                </Link>
              )}
              <Link href="/browse">
                <Button>Home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
