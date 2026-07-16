import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Chiari - Pastelería',
  description: 'Gestión de pastelería',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="bg-cream min-h-screen">{children}</body>
    </html>
  )
}
