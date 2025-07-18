'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Bot, Info, Calendar, Clock } from 'lucide-react'

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

  // Dati di esempio per gli aggiornamenti
  const changelog = [
    { version: '1.0.1', date: '25/07/2024', description: 'Migliorata la velocità di caricamento della Kanban Board.' },
    { version: '1.0.0', date: '20/07/2024', description: 'Lancio iniziale del Sistema Gestionale.' },
  ]

  return (
    <div className="min-h-screen w-full bg-gray-900 text-white relative overflow-hidden">
      {/* Sfondo con effetto gradiente e blur */}
      <div className="absolute top-0 left-0 w-full h-full bg-cover bg-center" style={{backgroundImage: "url('/background-abstract.jpg')"}}></div>
      <div className="absolute top-0 left-0 w-full h-full bg-black/50 backdrop-blur-sm"></div>

      <div className="relative z-10 flex flex-col justify-between min-h-screen p-4 sm:p-8">
        {/* Header con data e ora */}
        <header className="w-full max-w-7xl mx-auto">
          <LiveClock />
        </header>

        {/* Contenuto Centrale */}
        <main className="flex-grow flex items-center justify-center">
          <div 
            className="w-full max-w-lg p-8 space-y-6 rounded-2xl
                       bg-white/10 backdrop-blur-md border border-white/20 shadow-lg"
          >
            <div className="text-center">
              <h1 className="text-3xl sm:text-4xl font-bold">Gestionale Ottica Bianchi</h1>
              <p className="mt-2 text-gray-300">La tua piattaforma per la gestione operativa.</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={() => router.push('/login')}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 font-semibold 
                           bg-blue-600 hover:bg-blue-500 rounded-lg transition-all"
              >
                <span>Accedi</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <button 
                onClick={() => router.push('/signup')}
                className="w-full px-6 py-3 font-semibold bg-white/20 hover:bg-white/30 rounded-lg transition-all"
              >
                Registrati
              </button>
            </div>
          </div>
        </main>

        {/* Footer con aggiornamenti e help */}
        <footer className="w-full max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          {/* Colonna Aggiornamenti */}
          <div className="bg-black/20 p-4 rounded-lg backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold">Ultimi Aggiornamenti</h3>
            </div>
            <ul className="text-sm space-y-1 text-gray-300">
              {changelog.map(item => (
                <li key={item.version}>
                  <span className="font-mono bg-gray-700 px-1.5 py-0.5 rounded text-xs mr-2">{item.version}</span>
                  {item.description}
                </li>
              ))}
            </ul>
          </div>
          
          {/* Placeholder per altre info future */}
          <div className="hidden md:block"></div>

          {/* Colonna Assistente AI */}
          <div className="flex justify-center md:justify-end">
             <button className="flex items-center gap-3 px-6 py-3 font-semibold 
                                bg-purple-600 hover:bg-purple-500 rounded-lg transition-all
                                shadow-lg hover:shadow-purple-500/50">
                <Bot className="w-6 h-6" />
                <span>Chiedi all'Assistente AI</span>
             </button>
          </div>
        </footer>
      </div>
    </div>
  )
}