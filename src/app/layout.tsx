import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { UserProvider } from '@/context/UserContext'
import { Toaster } from 'sonner' // ← Import OK

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
      <body className={inter.className}>
        <UserProvider>
          {children}
          {/* ✅ AGGIUNGI QUESTO - Era mancante! */}
          <Toaster 
            position="top-right" 
            richColors 
            closeButton
            duration={4000}
            expand={true}
            visibleToasts={3}
          />
        </UserProvider>
      </body>
    </html>
  )
}