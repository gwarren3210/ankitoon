import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/**
 * 404 page for invalid series slugs.
 * Input: none
 * Output: 404 error page
 */
export default function SeriesNotFound() {
  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Series Not Found</CardTitle>
            <CardDescription>
              The series you&apos;re looking for doesn&apos;t exist or may have been removed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This could happen if:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>The series slug is incorrect</li>
              <li>The series hasn&apos;t been added to Toonky yet</li>
              <li>The series was removed</li>
            </ul>

            <div className="flex gap-2 pt-4">
              <Link href="/browse">
                <Button variant="outline">Browse All Series</Button>
              </Link>
              <Link href="/">
                <Button>Home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
