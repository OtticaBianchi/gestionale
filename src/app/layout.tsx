import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { UserProvider } from '@/context/UserContext'
import { Toaster } from 'sonner' // ← Import OK
// SpeedInsights loaded only in production via dynamic import inside component
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Carica Speed Insights solo quando giriamo su Vercel
  const isVercel = process.env.VERCEL === '1'
  const SpeedInsights = isVercel ? (await import('@vercel/speed-insights/next')).SpeedInsights : null
  return (
    <html lang="it">
      <head>
        <meta name="theme-color" content="#3b82f6" />
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
          {/* Load Speed Insights only in production to avoid 404 locally */}
          {SpeedInsights ? <SpeedInsights /> : null}
        </UserProvider>
      </body>
    </html>
  )
}
