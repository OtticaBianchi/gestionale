'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardCheck, ExternalLink, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import type { SchedaFocusMancanteRow } from '@/lib/scheda-focus/mancanti'

const STATO_LABELS: Record<string, string> = {
  nuove: 'Nuove',
  materiali_ordinati: 'Mat. ordinati',
  materiali_arrivati: 'Mat. arrivati',
  in_lavorazione: 'In lavorazione',
  pronto_ritiro: 'Pronto ritiro',
  consegnato_pagato: 'Consegnata',
}

const formatDay = (value: string) =>
  new Date(value.split('T')[0] + 'T12:00:00').toLocaleDateString('it-IT')

export default function SchedaFocusList() {
  const [rows, setRows] = useState<SchedaFocusMancanteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/scheda-focus')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Errore nel caricamento')
      setRows(json.rows || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const markDone = async (row: SchedaFocusMancanteRow) => {
    setSavingId(row.id)
    try {
      const res = await fetch(`/api/buste/${row.id}/scheda-focus`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fatta: true }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Errore salvataggio')
      setRows((prev) => prev.filter((r) => r.id !== row.id))
    } catch (e: any) {
      toast.error(`Scheda Focus: ${e.message}`)
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white/90 rounded-lg shadow-sm border border-slate-200/70 p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
        <p className="text-slate-500 mt-4">Caricamento Schede Focus...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50/70 border border-red-200/70 text-red-800 px-4 py-3 rounded-lg">{error}</div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white/90 rounded-lg shadow-sm border border-slate-200/70 p-12 text-center">
        <ClipboardCheck className="w-12 h-12 mx-auto text-slate-300 mb-4" />
        <h4 className="text-lg font-medium text-slate-900 mb-2">Nessuna Scheda Focus da fare</h4>
        <p className="text-slate-500">Tutte le buste ordinate hanno la Scheda Focus fatta.</p>
      </div>
    )
  }

  const scadute = rows.filter((r) => r.scaduta).length

  return (
    <div className="bg-white/90 rounded-lg shadow-sm border border-slate-200/70">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-800">
          Buste senza Scheda Focus ({rows.length})
        </h3>
        {scadute > 0 && (
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
            {scadute} URGENTI
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-600">
              <th className="px-4 py-2 font-semibold"># Busta</th>
              <th className="px-4 py-2 font-semibold">Cliente</th>
              <th className="px-4 py-2 font-semibold">Telefono</th>
              <th className="px-4 py-2 font-semibold">Tipo</th>
              <th className="px-4 py-2 font-semibold">Stato</th>
              <th className="px-4 py-2 font-semibold">Ordinata il</th>
              <th className="px-4 py-2 font-semibold">Situazione</th>
              <th className="px-4 py-2 font-semibold text-right">Azione</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`border-b border-slate-100 ${r.scaduta ? 'bg-red-50/60' : ''}`}>
                <td className="px-4 py-2.5 font-semibold whitespace-nowrap">
                  <Link
                    href={`/dashboard/buste/${r.id}`}
                    className="inline-flex items-center gap-1 text-[var(--ink)] hover:underline"
                  >
                    {r.readable_id}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">{r.cliente_nome}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{r.telefono || '—'}</td>
                <td className="px-4 py-2.5 font-medium text-slate-600">{r.tipo_lavorazione || '—'}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                  {STATO_LABELS[r.stato_attuale] || r.stato_attuale}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">{formatDay(r.data_ordine)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {r.scaduta ? (
                    <span className="font-semibold text-red-700">URGENTE - Fare Scheda Focus</span>
                  ) : (
                    <span className="text-slate-600">Da fare entro 2 gg lavorativi</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => markDone(r)}
                    disabled={savingId === r.id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {savingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Segna come fatta
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
