import { redirect } from 'next/navigation'

export default async function Home() {
  // Redirect to browse - AuthProvider handles showing login modal
  // if user is not authenticated
  redirect('/browse')
}
