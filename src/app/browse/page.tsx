import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card'

export default async function BrowsePage() {
  const user = await getAuthenticatedUser()
  
  if (!user) {
    redirect('/login')
  }

  const isAnonymous = user.is_anonymous

  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl">
        {isAnonymous && (
          <div className="mb-6 rounded-lg border border-amber-200 
                          bg-amber-50 p-4 dark:border-amber-800 
                          dark:bg-amber-950">
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 text-amber-600 dark:text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 
                     11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 
                               dark:text-amber-100">
                  You&apos;re using a guest account
                </h3>
                <p className="mt-1 text-sm text-amber-800 
                              dark:text-amber-200">
                  Sign up to save your progress permanently 
                  and access it from any device.
                </p>
                <a
                  href="/signup"
                  className="mt-2 inline-block text-sm 
                             font-medium text-amber-900 
                             underline hover:text-amber-700 
                             dark:text-amber-100 
                             dark:hover:text-amber-300"
                >
                  Create Account
                </a>
              </div>
            </div>
          </div>
        )}

        <h1 className="mb-8 text-4xl font-bold text-zinc-950 
                       dark:text-zinc-50">
          Browse Series
        </h1>
        <Card>
          <CardHeader>
            <CardTitle>Welcome to AnkiToon!</CardTitle>
            <CardDescription>
              {isAnonymous ? (
                'Browsing as guest'
              ) : (
                `You are logged in as ${user.email}`
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-zinc-600 dark:text-zinc-400">
              Series browsing coming soon. This page will show 
              available webtoon series with vocabulary decks.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/**
 * Gets authenticated user from Supabase session
 * Input: none
 * Output: User object or null
 */
async function getAuthenticatedUser() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  return user
}

