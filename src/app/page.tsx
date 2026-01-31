'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Info, Calendar, Clock } from 'lucide-react'

// --- Componente per l'orologio e la data live ---
const LiveClock = () => {
  const [time, setTime] = useState<Date | null>(null) // ✅ Inizia con null per evitare hydration mismatch
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true) // ✅ Segna che il componente è montato
    setTime(new Date()) // ✅ Imposta l'ora solo dopo il mount
    const timerId = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timerId)
  }, [])

  // ✅ EVITA HYDRATION MISMATCH - Mostra placeholder fino al mount
  if (!mounted || !time) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 text-center sm:text-left">
        <div className="flex items-center gap-2 justify-center">
          <Calendar className="w-5 h-5" />
          <span>Caricamento...</span>
        </div>
        <div className="flex items-center gap-2 justify-center font-bold text-lg">
          <Clock className="w-5 h-5" />
          <span>--:--</span>
        </div>
      </div>
    )
  }

  const formattedDate = time.toLocaleDateString('it-IT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const formattedTime = time.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 text-center sm:text-left">
      <div className="flex items-center gap-2 justify-center">
        <Calendar className="w-5 h-5" />
        <span>{formattedDate}</span>
      </div>
      <div className="flex items-center gap-2 justify-center font-bold text-lg">
        <Clock className="w-5 h-5" />
        <span>{formattedTime}</span>
      </div>
    </div>
  )
}

// --- Pagina principale ---
export default function WelcomePage() {
  const router = useRouter()

  // Aggiornamenti reali del sistema
  const changelog = [
    { version: '4.3.2', date: '31/01/2026', description: 'Lavorazioni: menu LS/LV/OCV esteso (Sagom./Lab.Int., Richiamo Verifica Tecnica, Verifica Non Adattamento) con filtri coerenti per lenti graduate.' },
    { version: '4.3.1', date: '30/01/2026', description: 'Dedup clienti: scansione completa con paginazione e normalizzazione avanzata, migliore riconoscimento duplicati con nomi invertiti o incompleti.' },
    { version: '4.3.0', date: '29/01/2026', description: 'Stampa busta con note consolidate, follow-up da 11 giorni, Lavorazioni con date Lab Esterno + checklist, cestino con recupero e dedup clienti, workflow approvazione procedure.' },
    { version: '4.1.1', date: '21/01/2026', description: 'Fix pagamenti (constraint DB), segnalazione errori diretta da sidebar, sync procedure ottimizzato, eliminazione fornitori admin-only, categoria Lenti in RICAMBI.' },
    { version: '4.1.0', date: '15/01/2026', description: 'Nuova gestione procedure con quiz e priorità, inserimento buste a posteriori con date ordine/consegna, dashboard admin per lettura procedure e superamento quiz.' },
    { version: '4.0.2', date: '10/12/2025', description: 'Import clienti manuale (1-9 alla volta), capitalizzazione intelligente nomi multi-parte (es. Di Maria), opzione P.Giuridica per genere cliente.' },
    { version: '3.4.0', date: '27/10/2025', description: 'Import clienti da CSV con validazioni, ricerca avanzata fase 1, riepiloghi workflow e modifica descrizione materiali.' },
    { version: '3.3.0', date: '25/10/2025', description: 'Availability badges, no-payment fix.' },
    { version: '3.2.1', date: '24/10/2025', description: 'VFT tra i tipi lavorazione, spedizioni con tracking e note, ricerca globale delle note, nuova categoria Ricambi e voce "Nessuna lavorazione".' },
    { version: '3.1.1', date: '15/10/2025', description: 'Nuova categoria Assistenza con workflow a due step: selezione tipo prodotto (Lenti/Montature/LAC/Sport/Accessori) e filtro intelligente fornitori. UX migliorata per riparazioni e servizi.' },
    { version: '3.1.0', date: '08/10/2025', description: 'Workflow automatizzato: avanzamento automatico buste (nuovo→materiali_ordinati→materiali_arrivati). Ordini "da negozio" per prodotti già in stock. Stato annullato per ordini cancellati. Workflow semplificato a 6 stati.' },
    { version: '3.0.1', date: '04/10/2025', description: 'Nuova pagina Analytics con dashboard Business Intelligence, statistiche dettagliate su lavorazioni, fornitori, fatturato, grafici interattivi e trend mensili.' },
    { version: '2.91', date: '02/10/2025', description: 'Ricerca clienti per cognome/telefono, fix duplicati follow-up, workflow Kanban bidirezionale, correzione 8 vulnerabilità sicurezza database.' },
    { version: '2.90', date: '01/10/2025', description: 'Categoria Accessori implementata, policies RLS lavorazioni corrette, auto-note follow-up, sidebar scrollabile.' },
    { version: '2.8.0', date: '19/09/2024', description: 'Sistema di tracking pagamenti migliorato e calcolo tempi di consegna aggiornato.' },
    { version: '2.7.0', date: '15/09/2024', description: 'Sistema Marketing completo con filtri brand e segmentazione clienti inattivi.' },
  ]

  return (
    <div className="min-h-screen w-full text-slate-900 relative overflow-hidden bg-[var(--paper)]">
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

      <div className="relative z-10 flex min-h-screen flex-col px-5 py-6 sm:px-10 sm:py-8 kiasma-body">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-lg">
              <img
                src="/kiasma-logo-tondo.png"
                alt="Kiasma"
                className="h-10 w-10"
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Optical Operating System</p>
              <h1 className="kiasma-hero text-2xl text-[var(--ink)]">Kiasma</h1>
            </div>
          </div>
          <div className="text-sm text-slate-600">
            <LiveClock />
          </div>
        </header>

        <main className="mx-auto mt-8 flex w-full max-w-6xl flex-1 flex-col gap-6 lg:flex-row lg:items-center">
          <section className="flex-1 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs text-slate-600 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[var(--teal)]" />
              Sistema operativo per l&apos;ottica moderna
            </div>
            <h2 className="kiasma-hero text-4xl leading-tight text-[var(--ink)] sm:text-5xl">
              Dove precisione e cura si incontrano.
            </h2>
            <p className="max-w-xl text-base text-slate-600">
              Il Sistema Operativo del tuo Centro Ottico: raccoglie ogni informazione, la interpreta,
              la rielabora e ti guida verso decisioni strategiche, con chiarezza e controllo.
            </p>

            <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.4)]">
              <div className="mb-3 flex items-center gap-2 text-sm text-slate-700">
                <Info className="h-4 w-4 text-[var(--teal)]" />
                Ultimi Aggiornamenti
              </div>
              <ul className="space-y-2 text-sm text-slate-600">
                {changelog.slice(0, 3).map((item) => (
                  <li key={item.version} className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 rounded-full bg-[var(--ink)]/90 px-2 py-0.5 text-[10px] font-semibold text-[var(--paper)]">
                        v{item.version}
                      </span>
                      <div>
                        <p className="text-xs text-slate-400">{item.date}</p>
                        <p>{item.description}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {changelog.length > 3 && (
                <details className="mt-3 text-sm text-slate-600">
                  <summary className="cursor-pointer text-slate-500 hover:text-slate-700">Storico completo</summary>
                  <ul className="mt-2 space-y-2">
                    {changelog.slice(3).map((item) => (
                      <li key={item.version} className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                        <span className="mr-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          v{item.version}
                        </span>
                        {item.description}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </section>

          <aside className="w-full max-w-md">
            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.45)]">
              <div className="mb-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Accesso rapido</p>
                <h3 className="kiasma-hero text-2xl text-[var(--ink)]">Area Operatori</h3>
                <p className="mt-1 text-sm text-slate-500">Accedi per gestire buste, clienti e workflow.</p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => router.push('/login')}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-[var(--paper)] transition hover:translate-y-[-1px] hover:bg-black"
                >
                  Accedi
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => router.push('/signup')}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Richiedi accesso
                </button>
              </div>

              <div className="mt-5 rounded-2xl bg-[var(--paper)] px-4 py-3 text-xs text-slate-500">
                Supporto clienti e formazione inclusi. Versione attuale: <strong>4.3.2</strong>
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  )
}
