'use client'

import { useEffect, useState } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'
import { ESITI, formatDataIt, importoPreventivo, type EsitoPreventivo } from '@/lib/preventivi/types'
import { buildPreventivoPdf, type PreventivoPdfRow } from '@/lib/preventivi/pdfClient'

type Row = PreventivoPdfRow & { id: string; esito: EsitoPreventivo }

/** Preventivo da cui nasce la busta (se collegato): riepilogo e PDF. Non compare se non c'è. */
export default function PreventivoBustaCard({ bustaId }: { bustaId: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/preventivi?busta_id=${bustaId}&stato=tutti`)
      .then((r) => (r.ok ? r.json() : { preventivi: [] }))
      .then((j) => !cancelled && setRows(j.preventivi || []))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [bustaId])

  if (rows.length === 0) return null

  const scarica = async (r: Row) => {
    setBusy(r.id)
    try {
      const { doc, nomeFile } = await buildPreventivoPdf(r)
      doc.save(nomeFile)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center mb-3">
        <FileText className="h-5 w-5 mr-2 text-gray-500" />
        Preventivo
      </h2>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              <strong>{r.numero_label}</strong> · {formatDataIt(r.data_stipula)} · {importoPreventivo(r)}
              <span className={`ml-2 rounded px-2 py-0.5 text-xs font-medium ${ESITI[r.esito]?.badge ?? ''}`}>{ESITI[r.esito]?.label}</span>
            </span>
            <button
              type="button"
              onClick={() => scarica(r)}
              disabled={busy === r.id}
              className="flex items-center gap-1 text-blue-600 hover:underline disabled:opacity-50"
            >
              {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} PDF
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
