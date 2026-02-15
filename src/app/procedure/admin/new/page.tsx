import Link from 'next/link'
import { ArrowLeft, Wrench, Sparkles } from 'lucide-react'

export default function NewProcedureWipPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-6">
          <Link
            href="/procedure/admin"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Torna a Gestione Procedure
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
              <Wrench className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Creazione Procedura via Web</h1>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-6">
            <p className="text-amber-900 font-medium">Stiamo lavorando a questa funzionalita.</p>
            <p className="text-amber-800 text-sm mt-1">
              La pagina di creazione guidata e in sviluppo.
            </p>
          </div>

          <div className="space-y-3 text-sm text-gray-700">
            <p className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
              Le nuove procedure vengono attualmente progettate con ChatGPT seguendo i principi di Ray Dalio e Scientific Management.
            </p>
            <p className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
              Ogni procedura include metadati e tag specifici per priorita, ruoli, categoria e governance operativa.
            </p>
            <p className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 mt-0.5 text-blue-600 flex-shrink-0" />
              Fino al rilascio della pagina web, il flusso attivo resta quello via markdown + import script.
            </p>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <Link
              href="/procedure/admin"
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Vai a Gestione Procedure
            </Link>
            <Link
              href="/procedure"
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Apri Manuale Procedure
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
