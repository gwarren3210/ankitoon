import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Navbar } from "@/components/navigation/navbar"
import { ThemeProvider } from "@/components/theme/themeProvider"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full flex flex-col`}
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
