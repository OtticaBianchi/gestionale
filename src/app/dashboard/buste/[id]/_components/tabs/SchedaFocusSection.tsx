'use client'

import { useEffect, useRef, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { toast } from 'sonner'
import { isSchedaFocusScaduta } from '@/lib/scheda-focus/giorniLavorativi'

interface SchedaFocusSectionProps {
  bustaId: string
  initialDataOrdine: string | null
  initialFatta: boolean
  // Cambia quando cambiano gli ordini: l'ordine può attivare la domanda (trigger DB) senza ricaricare la busta
  refreshKey: string
  disabled?: boolean
}

export default function SchedaFocusSection({
  bustaId,
  initialDataOrdine,
  initialFatta,
  refreshKey,
  disabled = false,
}: SchedaFocusSectionProps) {
  const [dataOrdine, setDataOrdine] = useState<string | null>(initialDataOrdine)
  const [fatta, setFatta] = useState(initialFatta)
  const [saving, setSaving] = useState(false)
  const isFirstRun = useRef(true)

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
    // Una volta attiva e fatta non serve rileggere; altrimenti il trigger potrebbe averla appena attivata
    if (dataOrdine && fatta) return
    let cancelled = false
    fetch(`/api/buste/${bustaId}/scheda-focus`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json) return
        setDataOrdine(json.scheda_focus_data_ordine ?? null)
        setFatta(Boolean(json.scheda_focus_fatta))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, bustaId])

  if (!dataOrdine) return null

  const scaduta = !fatta && isSchedaFocusScaduta(dataOrdine)

  const save = async (nuovoValore: boolean) => {
    if (saving || disabled || nuovoValore === fatta) return
    const precedente = fatta
    setFatta(nuovoValore)
    setSaving(true)
    try {
      const res = await fetch(`/api/buste/${bustaId}/scheda-focus`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fatta: nuovoValore }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Errore salvataggio')
    } catch (e: any) {
      setFatta(precedente)
      toast.error(`Scheda Focus: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const dataLabel = new Date(dataOrdine.split('T')[0] + 'T12:00:00').toLocaleDateString('it-IT')

  return (
    <div
      className={`rounded-lg border-2 border-l-8 p-4 shadow-sm ${
        scaduta ? 'border-red-400 bg-red-100' : 'border-indigo-400 bg-indigo-100'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className={`h-5 w-5 ${scaduta ? 'text-red-600' : 'text-indigo-600'}`} />
          <div>
            <p className={`text-base font-bold ${scaduta ? 'text-red-700' : 'text-indigo-900'}`}>
              Hai già fatto la Scheda Focus?
            </p>
            <p className={`text-xs ${scaduta ? 'text-red-600' : 'text-indigo-700'}`}>
              {scaduta
                ? `URGENTE - Fare Scheda Focus (ordine del ${dataLabel})`
                : `Ordine del ${dataLabel}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <label className={`flex items-center gap-2 text-base font-medium ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={fatta}
              disabled={disabled || saving}
              onChange={() => save(true)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span>Sì</span>
          </label>
          <label className={`flex items-center gap-2 text-base font-medium ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
            <input
              type="checkbox"
              checked={!fatta}
              disabled={disabled || saving}
              onChange={() => save(false)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className={scaduta ? 'font-semibold text-red-700' : ''}>No</span>
          </label>
        </div>
      </div>
    </div>
  )
}
