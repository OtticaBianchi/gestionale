import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { UserProvider } from '@/context/UserContext'
import { Toaster } from 'sonner' // ← Import OK
import { SpeedInsights } from "@vercel/speed-insights/next"
import SessionManager from '@/components/SessionManager'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Ottica Bianchi - Gestionale | Moduli',
  description: 'Sistema Kanban intelligente per gestione BUSTE (ciclo "produzione" e amministrativo)',
  keywords: ['ottica', 'gestionale', 'kanban', 'buste', 'clienti'],
  authors: [{ name: 'Timoteo Pasquali - Ottica Bianchi' }],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="OB Voice" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className={inter.className}>
        <UserProvider>
          {children}
          <SessionManager />
          {/* ✅ AGGIUNGI QUESTO - Era mancante! */}
          <Toaster 
            position="top-right" 
            richColors 
            closeButton
            duration={4000}
            expand={true}
            visibleToasts={3}
          />
          <SpeedInsights />
        </UserProvider>
      </body>
    </html>
  )
}