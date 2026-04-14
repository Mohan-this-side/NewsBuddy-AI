import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI News Reporter - Your Intelligent News Companion',
  description: 'Stay informed with AI-powered news reporting and interactive voice conversations',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <Navbar />
        <main className="pt-20 flex-1 min-h-0 w-full">
          {children}
        </main>
      </body>
    </html>
  )
}
