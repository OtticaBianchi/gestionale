'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('🔑 LOGIN - Starting client-side login with fixed UserContext...')
    console.log('🔑 LOGIN - Email:', email)
    
    setError(null)
    setIsLoading(true)
    
    try {
      console.log('🔑 LOGIN - Calling signInWithPassword (should work now)...')
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log('🔑 LOGIN - SignIn completed:', {
        success: !error,
        error: error?.message,
        user: data?.user?.email
      })
      
      if (error) {
        console.log('🔑 LOGIN - Error occurred:', error.message)
        setError(error.message === 'Invalid login credentials' ? 'Email o password non validi.' : error.message)
        setIsLoading(false)
        return
      }

      if (data?.user) {
        console.log('🔑 LOGIN - Success! User authenticated, UserContext will handle redirect...')
        // UserContext will load profile and redirect automatically
        // Keep loading state until redirect happens
      } else {
        setError('Login fallito - nessun utente ricevuto')
        setIsLoading(false)
      }
      
    } catch (e) {
      console.error('🔑 LOGIN - Unexpected error:', e)
      setError('Si è verificato un errore imprevisto.')
      setIsLoading(false)
    }
  }

  const handleMagicLink = async () => {
    setError(null)
    if (!email) {
      setError('Inserisci la tua email per ricevere il link magico.')
      return
    }
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Unify all email flows to the client-side confirm handler
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      })
      if (error) {
        setError(error.message)
      } else {
        alert('Controlla la tua email per il link d\'accesso!')
      }
    } catch (e) {
      setError('Si è verificato un errore imprevisto.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[var(--paper)] text-slate-900">
      <style jsx global>{`
        :root {
          --paper: #f6f1e9;
          --ink: #1b1f24;
          --teal: #0f6a6e;
          --copper: #b2734b;
        }
        .kiasma-hero {
          font-family: "DM Serif Display", "Iowan Old Style", "Times New Roman", serif;
        }
        .kiasma-body {
          font-family: "Space Grotesk", "Helvetica Neue", Arial, sans-serif;
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(15,106,110,0.18),transparent_55%),radial-gradient(circle_at_80%_10%,rgba(178,115,75,0.18),transparent_45%),radial-gradient(circle_at_60%_80%,rgba(15,106,110,0.12),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(120deg,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(0deg,rgba(0,0,0,0.04)_1px,transparent_1px)] [background-size:40px_40px]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8 kiasma-body">
        <div className="w-full max-w-md space-y-6 rounded-[28px] border border-slate-200 bg-white/90 p-8 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-lg">
              <img
                src="/kiasma-logo-tondo.png"
                alt="Kiasma"
                className="h-11 w-11"
              />
            </div>
            <div className="text-left">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Optical Operating System</p>
              <h2 className="kiasma-hero text-2xl text-[var(--ink)]">Accesso Kiasma</h2>
            </div>
          </div>

        {error && (
          <div className="flex items-center rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            <AlertCircle className="mr-3 h-4 w-4 flex-shrink-0" />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="sr-only">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Mail className="w-5 h-5 text-gray-400" />
              </div>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white/80 py-2.5 pl-10 pr-3 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--teal)]/30"
                placeholder="Email"
              />
            </div>
          </div>
          <div>
            <label htmlFor="password" className="sr-only">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Lock className="w-5 h-5 text-gray-400" />
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  const next = e.target.value
                  setPassword(next)
                  if (!next) {
                    setShowPassword(false)
                  }
                }}
                className="w-full rounded-xl border border-slate-200 bg-white/80 py-2.5 pl-10 pr-10 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--teal)]/30"
                placeholder="Password"
              />
              {password.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                  aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-[var(--ink)] px-4 py-3 text-sm font-semibold text-[var(--paper)] transition hover:translate-y-[-1px] hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isLoading ? 'Accesso in corso...' : 'Accedi'}
          </button>
        </form>

        {/* Link reset password */}
        <div className="flex items-center justify-between text-sm">
          <div></div>
          <a href="/reset-password" className="text-slate-600 hover:text-slate-800">Password dimenticata?</a>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-slate-500">Oppure</span>
          </div>
        </div>
        
        <button
          onClick={handleMagicLink}
          disabled={isLoading || !email}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          Invia link d'accesso rapido
        </button>

        <div className="text-center text-sm text-slate-500">
          La creazione di account è consentita solo su invito
        </div>

        <div className="mt-6 border-t border-slate-200 pt-6">
          <div className="mb-2 text-center text-xs text-slate-400">
            Versione 4.3.5
          </div>
          <div className="text-xs text-slate-500">
            <div className="text-center font-medium text-slate-600">Ultimi aggiornamenti</div>
            <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 text-left">
              <div className="font-semibold text-slate-700">v4.3.5 - Febbraio 2026</div>
              <ul className="ml-2 list-disc list-inside space-y-1">
                <li>Survey: import CSV integrato in Governance {'>'} Import Clienti</li>
                <li>Deduplicazione ortografica con auto-merge configurabile e revisione manuale</li>
                <li>Ricerca avanzata: filtro survey con estrazione completa partecipanti senza testo</li>
                <li>Follow-up survey live sempre attivo per casi attenzione/critico</li>
              </ul>
              <div className="font-semibold text-slate-700">v4.3.4 - Febbraio 2026</div>
              <ul className="ml-2 list-disc list-inside space-y-1">
                <li>Controllo qualità: storico per ciclo + timeline in sidebar</li>
                <li>Riapertura buste archiviate con reset QC e nuovo ciclo</li>
                <li>Follow-up tecnici urgenti con motivo e pianificazione</li>
                <li>Checklist sagomatura e toggle mostra password login</li>
              </ul>
              <div className="font-semibold text-slate-700">v4.3.3 - Febbraio 2026</div>
              <ul className="ml-2 list-disc list-inside space-y-1">
                <li>Nuovi menu lenti obbligatori (tipo, classificazione, trattamenti con opzione "Nessuno")</li>
                <li>Badge info ordini in Materiali e Operazioni con tipo lente, fornitore e trattamenti</li>
                <li>Analytics: tempi consegna lenti, lead time buste e breakdown pagamenti/acconti</li>
              </ul>
              <div className="font-semibold text-slate-700">v4.3.2 - Gennaio 2026</div>
              <ul className="ml-2 list-disc list-inside space-y-1">
                <li>Lavorazioni: menu LS/LV/OCV esteso con Sagom./Lab.Int., Richiamo Verifica Tecnica e Verifica Non Adattamento</li>
                <li>Allineamento filtri lavorazioni per lenti graduate e occhiali completi</li>
              </ul>
              <div className="font-semibold text-slate-700">v4.3.1 - Gennaio 2026</div>
              <ul className="ml-2 list-disc list-inside space-y-1">
                <li>Dedup clienti: scansione completa con paginazione e normalizzazione avanzata</li>
                <li>Migliore riconoscimento duplicati con nomi invertiti o incompleti</li>
              </ul>
              <div className="font-semibold text-slate-700">v4.3.0 - Gennaio 2026</div>
              <ul className="ml-2 list-disc list-inside space-y-1">
                <li>Stampa busta con note consolidate (metadati e date)</li>
                <li>Follow-up da 11 giorni con filtri consegna corretti</li>
                <li>Lavorazioni: date Lab Esterno + checklist DB con gating</li>
                <li>Cestino: soft delete, recupero e svuota cestino (admin)</li>
                <li>Dedup clienti (admin) + approvazione procedure</li>
              </ul>
              <div className="font-semibold text-slate-700">v4.1.1 - Gennaio 2026</div>
              <ul className="ml-2 list-disc list-inside space-y-1">
                <li>Fix pagamenti: risolti vincoli DB per salvataggio importi</li>
                <li>Segnalazione errori diretta da sidebar (apre form modale)</li>
                <li>Sync procedure ottimizzato (aggiorna solo modificate)</li>
                <li>Eliminazione fornitori riservata admin</li>
                <li>Nuova categoria Lenti in RICAMBI</li>
              </ul>
            </div>
            <details className="mt-3">
              <summary className="mx-auto w-fit cursor-pointer rounded-full border border-slate-200 bg-white px-3 py-1 text-center font-medium text-slate-600 shadow-sm hover:text-slate-800">
                Storico completo
              </summary>
              <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 text-left">
                <div className="font-semibold text-slate-700">v4.1.0 - Gennaio 2026</div>
                <ul className="ml-2 list-disc list-inside space-y-1">
                  <li>Nuova gestione procedure con quiz e livelli di priorità</li>
                  <li>Inserimento buste a posteriori con date ordine/consegna</li>
                  <li>Dashboard admin per lettura procedure e superamento quiz</li>
                </ul>
                <div className="font-semibold text-slate-700">v4.0.2 - Dicembre 2025</div>
                <ul className="ml-2 list-disc list-inside space-y-1">
                  <li>Import clienti manuale con form dinamico (1-9 clienti alla volta)</li>
                  <li>Capitalizzazione intelligente per nomi multi-parte (es. Di Maria, Van Der Berg)</li>
                  <li>Opzione P.Giuridica aggiunta al campo genere cliente</li>
                  <li>Sistema di validazione granulare con feedback per cliente</li>
                </ul>
                <div className="mt-3 font-semibold text-slate-700">v3.4.0 - Ottobre 2025</div>
                <ul className="ml-2 list-disc list-inside space-y-1">
                  <li>Import clienti da CSV con validazioni e report finale</li>
                  <li>Ricerca avanzata fase 1 con filtri combinati e ID busta</li>
                  <li>Modifica rapida della descrizione in MaterialiTab</li>
                  <li>Riepiloghi stati workflow e anagrafica senza data nascita</li>
                </ul>
                <div className="mt-3 font-semibold text-slate-700">v3.3.0 - Ottobre 2025</div>
                <ul className="ml-2 list-disc list-inside space-y-1">
                  <li>Tipo lavorazione VFT e migrazione dedicata</li>
                  <li>Spedizioni: tracking, note e date aggiornate</li>
                  <li>Ricerca note globale e categoria Ricambi guidata</li>
                  <li>Opzione "Nessuna lavorazione" rapida nel tab</li>
                </ul>
                <div className="mt-3 font-semibold text-slate-700">v3.1.1 - Ottobre 2025</div>
                <ul className="ml-2 list-disc list-inside space-y-1">
                  <li>Nuova categoria Assistenza in MaterialiTab</li>
                  <li>Workflow migliorato con selezione tipo prodotto</li>
                  <li>Filtro fornitori intelligente per assistenza</li>
                </ul>
                <div className="mt-3 font-semibold text-slate-700">v3.1.0 - Ottobre 2025</div>
                <ul className="ml-2 list-disc list-inside space-y-1">
                  <li>Workflow automatizzato: avanzamento automatico buste</li>
                  <li>Ordini "da negozio" per prodotti già in stock</li>
                  <li>Stato "annullato" per ordini cancellati</li>
                  <li>Workflow semplificato a 6 stati</li>
                </ul>
                <div className="mt-3 font-semibold text-slate-700">v3.0.1 - Ottobre 2025</div>
                <ul className="ml-2 list-disc list-inside space-y-1">
                  <li>Nuova pagina Analytics con dashboard Business Intelligence</li>
                  <li>Statistiche dettagliate su lavorazioni, fornitori e fatturato</li>
                  <li>Grafici interattivi e trend mensili</li>
                </ul>
              </div>
            </details>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="relative flex min-h-screen items-center justify-center bg-[var(--paper)] text-slate-900">
        <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white/90 p-8 text-center shadow-[0_30px_80px_-40px_rgba(0,0,0,0.45)]">
          Caricamento...
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
