'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ClipboardList, RefreshCw, History, Loader2, Search, Plus, ChevronDown } from 'lucide-react'
import { AlertBusta, BriefingSezione } from '@/types/briefing'
import SectionBlock from './SectionBlock'
import BriefingRow from './BriefingRow'
import Link from 'next/link'

interface AssignableProfile {
  id: string
  full_name: string
  role: string
}

interface BriefingClientProps {
  currentUserId: string
  currentUserName: string
  assignableProfiles: AssignableProfile[]
}

interface TaskDraft {
  busta_id: string
  readable_id: string
  tipo_lavorazione: string
  stato_attuale: string
  priorita: string
  note_generali: string | null
  ore_in_stato: number
  sezione: BriefingSezione
  motivo: string
  cliente_nome: string
  cliente_cognome: string
  cliente_telefono: string | null
  assegnato_a: string | null
  nota_admin: string
}

type PageState = 'idle' | 'loading_alerts' | 'composing' | 'saving'

export default function BriefingClient({
  currentUserId,
  currentUserName,
  assignableProfiles,
}: BriefingClientProps) {
  const router = useRouter()
  const today = new Date().toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const [pageState, setPageState] = useState<PageState>('idle')
  const [tasks, setTasks] = useState<TaskDraft[]>([])
  const [noteGenerali, setNoteGenerali] = useState('')

  // Sezione manuale
  const [manualSearch, setManualSearch] = useState('')
  const [manualResults, setManualResults] = useState<AlertBusta[]>([])
  const [manualSearching, setManualSearching] = useState(false)
  const [manualMotivo, setManualMotivo] = useState<Record<string, string>>({})

  // Dropdown stampa
  const [showPrintMenu, setShowPrintMenu] = useState(false)
  const [saving, setSaving] = useState(false)

  // Sezioni
  const urgenze = tasks.filter(t => t.sezione === 'urgenze')
  const inceppate = tasks.filter(t => t.sezione === 'flusso_inceppato')
  const materiali = tasks.filter(t => t.sezione === 'materiali_ritardo')
  const manuali = tasks.filter(t => t.sezione === 'manuale')

  const handleGenera = useCallback(async () => {
    // Controlla se esiste già uno snapshot oggi
    try {
      const checkRes = await fetch('/api/briefing')
      if (checkRes.ok) {
        const { snapshots } = await checkRes.json()
        const todayStr = new Date().toISOString().slice(0, 10)
        const existingToday = snapshots?.find((s: { data_briefing: string }) => s.data_briefing === todayStr)
        if (existingToday) {
          const proceed = window.confirm(
            `Esiste già un briefing per oggi (generato alle ${new Date(existingToday.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}).\n\nVuoi crearne uno nuovo?`
          )
          if (!proceed) {
            router.push(`/dashboard/briefing/${existingToday.id}`)
            return
          }
        }
      }
    } catch {
      // ignora errore check, procedi comunque
    }

    setPageState('loading_alerts')
    try {
      const res = await fetch('/api/briefing/alerts')
      if (!res.ok) throw new Error('Errore nel caricamento degli alert')
      const { alerts } = await res.json() as { alerts: AlertBusta[] }

      setTasks(alerts.map(a => ({
        busta_id: a.busta_id,
        readable_id: a.readable_id,
        tipo_lavorazione: a.tipo_lavorazione,
        stato_attuale: a.stato_attuale,
        priorita: a.priorita,
        note_generali: a.note_generali,
        ore_in_stato: a.ore_in_stato,
        sezione: a.sezione,
        motivo: a.motivo,
        cliente_nome: a.cliente_nome,
        cliente_cognome: a.cliente_cognome,
        cliente_telefono: a.cliente_telefono,
        assegnato_a: null,
        nota_admin: '',
      })))
      setPageState('composing')
    } catch {
      toast.error('Errore nel caricamento degli alert')
      setPageState('idle')
    }
  }, [router])

  const handleAssign = useCallback((bustaId: string, profileId: string | null) => {
    setTasks(prev => prev.map(t => t.busta_id === bustaId ? { ...t, assegnato_a: profileId } : t))
  }, [])

  const handleNota = useCallback((bustaId: string, nota: string) => {
    setTasks(prev => prev.map(t => t.busta_id === bustaId ? { ...t, nota_admin: nota } : t))
  }, [])

  const handleRemove = useCallback((bustaId: string) => {
    setTasks(prev => prev.filter(t => t.busta_id !== bustaId))
  }, [])

  const handleManualSearch = useCallback(async () => {
    if (!manualSearch.trim()) return
    setManualSearching(true)
    try {
      const res = await fetch(`/api/search/advanced?q=${encodeURIComponent(manualSearch)}&limit=10`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      const results: AlertBusta[] = (data.buste ?? []).map((b: {
        id: string; readable_id: string; tipo_lavorazione: string;
        stato_attuale: string; priorita: string; note_generali: string | null;
        updated_at: string; clienti?: { nome: string; cognome: string; telefono: string | null }
      }) => ({
        busta_id: b.id,
        readable_id: b.readable_id,
        tipo_lavorazione: b.tipo_lavorazione ?? '',
        stato_attuale: b.stato_attuale ?? '',
        priorita: b.priorita ?? 'normale',
        note_generali: b.note_generali,
        ore_in_stato: 0,
        sezione: 'manuale' as BriefingSezione,
        motivo: '',
        cliente_nome: b.clienti?.nome ?? '',
        cliente_cognome: b.clienti?.cognome ?? '',
        cliente_telefono: b.clienti?.telefono ?? null,
      }))
      setManualResults(results)
    } catch {
      toast.error('Errore nella ricerca')
    } finally {
      setManualSearching(false)
    }
  }, [manualSearch])

  const handleAddManual = useCallback((alert: AlertBusta) => {
    const motivo = manualMotivo[alert.busta_id] ?? ''
    if (!motivo.trim()) {
      toast.error('Inserisci un motivo prima di aggiungere la busta')
      return
    }
    if (tasks.some(t => t.busta_id === alert.busta_id)) {
      toast.error('Questa busta è già nel briefing')
      return
    }
    setTasks(prev => [...prev, {
      ...alert,
      sezione: 'manuale' as BriefingSezione,
      motivo,
      assegnato_a: null,
      nota_admin: '',
    }])
    setManualResults(prev => prev.filter(r => r.busta_id !== alert.busta_id))
    setManualMotivo(prev => { const n = { ...prev }; delete n[alert.busta_id]; return n })
  }, [tasks, manualMotivo])

  const doSave = useCallback(async () => {
    if (saving) return
    setSaving(true)
    try {
      const body = {
        note_generali: noteGenerali || null,
        tasks: tasks.map(t => ({
          busta_id: t.busta_id,
          sezione: t.sezione,
          motivo: t.motivo,
          assegnato_a: t.assegnato_a || null,
          nota_admin: t.nota_admin || null,
        })),
      }
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      const { snapshot } = await res.json()
      return snapshot.id as string
    } catch {
      toast.error('Errore nel salvataggio del briefing')
      return null
    } finally {
      setSaving(false)
    }
  }, [saving, noteGenerali, tasks])

  const handleSaveDraft = useCallback(async () => {
    const id = await doSave()
    if (id) {
      toast.success('Briefing salvato')
      router.push(`/dashboard/briefing/${id}`)
    }
  }, [doSave, router])

  const handlePrint = useCallback(async (personaId?: string) => {
    setShowPrintMenu(false)
    const id = await doSave()
    if (!id) return
    const url = personaId
      ? `/dashboard/briefing/stampa/${id}?persona=${personaId}`
      : `/dashboard/briefing/stampa/${id}`
    router.push(url)
  }, [doSave, router])

  if (pageState === 'idle') {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList className="w-6 h-6" />
              Briefing Operativo
            </h1>
            <p className="text-sm text-gray-500 mt-1 capitalize">{today}</p>
          </div>
          <Link
            href="/dashboard/briefing/storico"
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border rounded-lg px-3 py-2"
          >
            <History className="w-4 h-4" />
            Storico
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <button
            onClick={handleGenera}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-xl text-lg shadow transition-colors"
          >
            <ClipboardList className="w-5 h-5" />
            Genera Briefing di Oggi
          </button>
          <p className="text-sm text-gray-400">Analizza le buste attive e prepara il briefing mattutino</p>
        </div>
      </div>
    )
  }

  if (pageState === 'loading_alerts') {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-gray-500">Analisi buste in corso...</p>
      </div>
    )
  }

  // pageState === 'composing'
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6" />
            Briefing Operativo
          </h1>
          <p className="text-sm text-gray-500 mt-1 capitalize">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenera}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border rounded-lg px-3 py-2"
            title="Ricarica alert"
          >
            <RefreshCw className="w-4 h-4" />
            Aggiorna
          </button>
          <Link
            href="/dashboard/briefing/storico"
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border rounded-lg px-3 py-2"
          >
            <History className="w-4 h-4" />
            Storico
          </Link>
        </div>
      </div>

      {/* Note generali */}
      <div>
        <textarea
          value={noteGenerali}
          onChange={e => setNoteGenerali(e.target.value)}
          placeholder="Note generali del briefing (opzionale)..."
          rows={2}
          className="w-full border rounded-lg px-3 py-2 text-sm text-gray-700 resize-none"
        />
      </div>

      {/* Sezione 1 — Urgenze */}
      <SectionBlock title="Urgenze" icon="🔴" count={urgenze.length}>
        {urgenze.map(t => (
          <BriefingRow
            key={t.busta_id}
            item={t}
            assignableProfiles={assignableProfiles}
            onAssign={handleAssign}
            onNota={handleNota}
            onRemove={handleRemove}
            showRemove
          />
        ))}
      </SectionBlock>

      {/* Sezione 2 — Flusso inceppato */}
      <SectionBlock title="Flusso Inceppato" icon="⏱" count={inceppate.length}>
        {inceppate.map(t => (
          <BriefingRow
            key={t.busta_id}
            item={t}
            assignableProfiles={assignableProfiles}
            onAssign={handleAssign}
            onNota={handleNota}
            onRemove={handleRemove}
            showRemove
          />
        ))}
      </SectionBlock>

      {/* Sezione 3 — Materiali in ritardo */}
      <SectionBlock title="Materiali in Ritardo" icon="📦" count={materiali.length}>
        {materiali.map(t => (
          <BriefingRow
            key={t.busta_id}
            item={t}
            assignableProfiles={assignableProfiles}
            onAssign={handleAssign}
            onNota={handleNota}
            onRemove={handleRemove}
            showRemove
          />
        ))}
      </SectionBlock>

      {/* Sezione 4 — Aggiunte manuali */}
      <SectionBlock title="Aggiunte Manuali" icon="✏️" count={manuali.length} defaultOpen>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={manualSearch}
            onChange={e => setManualSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleManualSearch()}
            placeholder="Cerca busta per ID o cognome cliente..."
            className="flex-1 border rounded-lg px-3 py-2 text-sm text-gray-700"
          />
          <button
            onClick={handleManualSearch}
            disabled={manualSearching}
            className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {manualSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Cerca
          </button>
        </div>

        {manualResults.length > 0 && (
          <div className="space-y-2 mb-3">
            {manualResults.map(r => (
              <div key={r.busta_id} className="border rounded-lg p-2 bg-white flex items-center gap-2">
                <div className="flex-1 text-sm">
                  <span className="font-mono font-semibold">{r.readable_id}</span>
                  {' — '}
                  <span>{r.cliente_cognome} {r.cliente_nome}</span>
                  <span className="ml-2 text-gray-500 text-xs">({r.tipo_lavorazione})</span>
                </div>
                <input
                  type="text"
                  placeholder="Motivo (obbligatorio)..."
                  value={manualMotivo[r.busta_id] ?? ''}
                  onChange={e => setManualMotivo(prev => ({ ...prev, [r.busta_id]: e.target.value }))}
                  className="border rounded px-2 py-1 text-xs flex-1 min-w-[160px]"
                />
                <button
                  onClick={() => handleAddManual(r)}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Aggiungi
                </button>
              </div>
            ))}
          </div>
        )}

        {manuali.map(t => (
          <BriefingRow
            key={t.busta_id}
            item={t}
            assignableProfiles={assignableProfiles}
            onAssign={handleAssign}
            onNota={handleNota}
            onRemove={handleRemove}
            showRemove
          />
        ))}

        {manuali.length === 0 && manualResults.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-2">
            Cerca e aggiungi buste manualmente
          </p>
        )}
      </SectionBlock>

      {/* Nessuna criticità */}
      {tasks.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p className="text-2xl mb-2">🎉</p>
          <p className="font-medium">Nessuna criticità rilevata oggi</p>
          <p className="text-sm mt-1">Puoi comunque aggiungere buste manualmente nella sezione sopra</p>
        </div>
      )}

      {/* Azioni */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t">
        <button
          onClick={handleSaveDraft}
          disabled={saving}
          className="flex items-center gap-2 border rounded-lg px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Salva Bozza
        </button>

        <div className="relative">
          <div className="flex">
            <button
              onClick={() => handlePrint()}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-l-lg text-sm disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Genera & Stampa
            </button>
            <button
              onClick={() => setShowPrintMenu(v => !v)}
              disabled={saving}
              className="bg-blue-700 hover:bg-blue-800 text-white px-2 py-2.5 rounded-r-lg border-l border-blue-500 disabled:opacity-50"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {showPrintMenu && (
            <div className="absolute right-0 bottom-full mb-1 bg-white border rounded-lg shadow-lg py-1 z-10 min-w-[200px]">
              <button
                onClick={() => handlePrint()}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
              >
                Stampa tutto
              </button>
              <div className="border-t my-1" />
              {assignableProfiles.map(p => (
                <button
                  key={p.id}
                  onClick={() => handlePrint(p.id)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Stampa per {p.full_name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
