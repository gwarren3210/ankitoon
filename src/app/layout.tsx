import type { Metadata } from "next"
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google"
import "./globals.css"
import { Navbar } from "@/components/navigation/navbar"
import { ThemeProvider } from "@/components/theme/themeProvider"
import { getConfig } from "@/lib/config/env"

// Validate environment variables at module load time.
// This runs once when the server starts, ensuring fail-fast behavior
// if required variables are missing.
try {
  getConfig()
} catch (error) {
  // In production, exit immediately to prevent running with bad config
  if (process.env.NODE_ENV === 'production') {
    process.exit(1)
  }
  // In development, re-throw to show the error
  throw error
}

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Toonky - Learn the words. Read the story.",
  description: "Learn the words. Read the story.",
  icons: {
    icon: '/toonky-logo.png',
    apple: '/toonky-logo.png',
    shortcut: '/toonky-logo.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body
        className={`${plusJakartaSans.variable} ${geistMono.variable} antialiased h-full flex flex-col`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex-1 flex flex-col min-h-0">
            <Navbar />
            <main className="flex-1 min-h-0">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
