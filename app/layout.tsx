import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CodeVisualise',
  description: 'Live codebase visualizer powered by Claude',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
