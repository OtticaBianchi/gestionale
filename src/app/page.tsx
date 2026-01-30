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

// test deploy automatico
// belin che casino sto vercel
// test con deploy hook ricreato

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
    <div className="min-h-screen w-full bg-gray-900 text-white relative overflow-hidden">
      {/* Sfondo con effetto gradiente e blur */}
      <div className="absolute top-0 left-0 w-full h-full bg-contain bg-center bg-no-repeat" style={{backgroundImage: "url('/Kiasma-hero.png')"}}></div>
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-black/25 via-black/25 to-black/45"></div>

      <div className="relative z-10 flex flex-col justify-between min-h-screen p-4 sm:p-8">
        {/* Header con data e ora */}
        <header className="w-full max-w-7xl mx-auto">
          <LiveClock />
        </header>

        {/* Contenuto Centrale */}
        <main className="flex-grow flex items-end justify-start">
          <div 
            className="w-full max-w-md p-6 space-y-5 rounded-2xl
                       bg-white/10 backdrop-blur-md border border-white/20 shadow-lg"
          >
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl font-bold">Gestionale Ottica Bianchi</h1>
              <p className="mt-2 text-gray-300">La tua piattaforma per la gestione operativa.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={() => router.push('/login')}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 font-semibold 
                           bg-blue-600 hover:bg-blue-500 rounded-lg transition-all"
              >
                <span>Accedi</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <button 
                onClick={() => router.push('/signup')}
                className="w-full px-5 py-2.5 font-semibold bg-white/20 hover:bg-white/30 rounded-lg transition-all"
              >
                Registrati
              </button>
            </div>
          </div>
        </main>

        {/* Footer con aggiornamenti */}
        <footer className="w-full max-w-7xl mx-auto">
          {/* Colonna Aggiornamenti */}
          <div className="bg-black/20 p-4 rounded-lg backdrop-blur-sm max-w-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold">Ultimi Aggiornamenti</h3>
            </div>
            <ul className="text-sm space-y-1 text-gray-300">
              {changelog.slice(0, 2).map(item => (
                <li key={item.version}>
                  <span className="font-mono bg-gray-700 px-1.5 py-0.5 rounded text-xs mr-2">{item.version}</span>
                  {item.description}
                </li>
              ))}
            </ul>
            {changelog.length > 2 && (
              <details className="mt-3 text-sm text-gray-300">
                <summary className="cursor-pointer text-gray-200 hover:text-white font-medium">
                  Storico completo
                </summary>
                <ul className="mt-2 space-y-1 text-gray-300">
                  {changelog.slice(2).map(item => (
                    <li key={item.version}>
                      <span className="font-mono bg-gray-700 px-1.5 py-0.5 rounded text-xs mr-2">{item.version}</span>
                      {item.description}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}
