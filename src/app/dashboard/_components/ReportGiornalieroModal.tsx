'use client';

import { useState } from 'react';
import { X, FileText, Printer, Loader2, Calendar, Clock } from 'lucide-react';
import type { BustaReportRow } from '@/app/api/report/buste-giornaliero/route';

const LAVORAZIONE_LABELS: Record<string, string> = {
  OCV: 'OCV', OV: 'OV', OS: 'OS', LV: 'LV', LS: 'LS',
  LAC: 'LAC', TALAC: 'TALAC', ACC: 'ACC', RIC: 'RIC', LAB: 'LAB',
  SA: 'SA', SG: 'SG', CT: 'CT', BR: 'BR', SPRT: 'SPRT',
  ES: 'ES', REL: 'REL', FT: 'FT', VFT: 'VFT', VC: 'VC',
};

function toItalianDate(isoString: string): string {
  return new Date(isoString).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function getYesterdayDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

interface Props {
  onClose: () => void;
}

export default function ReportGiornalieroModal({ onClose }: Props) {
  const [selectedDate, setSelectedDate] = useState<string>(getYesterdayDate())
  const [rows, setRows] = useState<BustaReportRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportDate, setReportDate] = useState<string | null>(null)

  const fetchReport = async (date: string) => {
    setIsLoading(true)
    setError(null)
    setRows([])
    try {
      const res = await fetch(`/api/report/buste-giornaliero?date=${date}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Errore sconosciuto')
      setRows(json.rows || [])
      setReportDate(json.date)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerate = () => fetchReport(selectedDate)

  const handleYesterday = () => {
    const d = getYesterdayDate()
    setSelectedDate(d)
    fetchReport(d)
  }

  const handlePrint = () => {
    if (!rows.length || !reportDate) return

    const dateLabel = new Date(reportDate + 'T12:00:00').toLocaleDateString('it-IT', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })

    const tableRows = rows.map(row => {
      const noteHtml = row.note.length
        ? row.note.map(n =>
            `<div class="note-entry"><span class="note-label">${n.label}:</span> ${n.text.replace(/\n/g, '<br/>')}</div>`
          ).join('')
        : '<span class="empty">—</span>'

      return `
        <tr>
          <td class="cell-id">${row.readable_id}</td>
          <td class="cell-cliente">${row.cliente_nome}</td>
          <td class="cell-tipo">${LAVORAZIONE_LABELS[row.tipo_lavorazione || ''] || row.tipo_lavorazione || '—'}</td>
          <td class="cell-operatore">${row.creato_da_nome}</td>
          <td class="cell-note">${noteHtml}</td>
        </tr>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <title>Report Buste – ${dateLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #1a1a1a; padding: 20px; }
    header { margin-bottom: 16px; border-bottom: 2px solid #0f6a6e; padding-bottom: 10px; }
    header h1 { font-size: 16px; font-weight: 700; color: #0f6a6e; }
    header p { font-size: 11px; color: #555; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #0f6a6e; color: white; }
    thead th { padding: 7px 8px; text-align: left; font-size: 10px; font-weight: 600; letter-spacing: 0.03em; text-transform: uppercase; }
    tbody tr { border-bottom: 1px solid #e5e7eb; }
    tbody tr:nth-child(even) { background: #f9fafb; }
    td { padding: 7px 8px; vertical-align: top; }
    .cell-id { white-space: nowrap; font-weight: 600; color: #0f6a6e; width: 90px; }
    .cell-cliente { width: 160px; }
    .cell-tipo { width: 60px; text-align: center; font-weight: 600; }
    .cell-operatore { width: 120px; }
    .cell-note { }
    .note-entry { margin-bottom: 4px; line-height: 1.4; }
    .note-entry:last-child { margin-bottom: 0; }
    .note-label { font-weight: 600; color: #374151; }
    .empty { color: #9ca3af; }
    footer { margin-top: 16px; font-size: 10px; color: #9ca3af; text-align: right; }
    @media print {
      body { padding: 10px; }
      @page { margin: 15mm; size: A4; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Report Buste – ${dateLabel}</h1>
    <p>${rows.length} busta${rows.length !== 1 ? 'e' : ''} aperta${rows.length !== 1 ? 'e' : ''}</p>
  </header>
  <table>
    <thead>
      <tr>
        <th># Busta</th>
        <th>Cliente</th>
        <th>Tipo</th>
        <th>Aperto da</th>
        <th>Note consolidate</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <footer>Generato il ${new Date().toLocaleString('it-IT')} · Kiasma Gestionale</footer>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`

    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(html)
    win.document.close()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--ink)]" />
            <h2 className="text-base font-semibold text-slate-900">Report Buste Giornaliero</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Data</label>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={selectedDate}
                  max={getTodayDate()}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="rounded-lg border border-slate-200 pl-8 pr-3 py-2 text-sm focus:border-[var(--ink)] focus:outline-none"
                />
              </div>
              <button
                onClick={handleYesterday}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                title="Ieri"
              >
                <Clock className="h-3.5 w-3.5" />
                <span>Ieri</span>
              </button>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isLoading || !selectedDate}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--ink)] px-4 py-2 text-sm text-white hover:bg-black disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            <span>Genera</span>
          </button>

          {rows.length > 0 && (
            <button
              onClick={handlePrint}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Stampa / PDF</span>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</p>
          )}

          {!isLoading && !error && reportDate && rows.length === 0 && (
            <p className="text-center text-sm text-slate-500 py-10">
              Nessuna busta aperta il {new Date(reportDate + 'T12:00:00').toLocaleDateString('it-IT')}.
            </p>
          )}

          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-200 text-left">
                    <th className="pb-2 pr-4 font-semibold text-slate-700 whitespace-nowrap"># Busta</th>
                    <th className="pb-2 pr-4 font-semibold text-slate-700">Cliente</th>
                    <th className="pb-2 pr-4 font-semibold text-slate-700">Tipo</th>
                    <th className="pb-2 pr-4 font-semibold text-slate-700 whitespace-nowrap">Aperto da</th>
                    <th className="pb-2 font-semibold text-slate-700">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id} className={`border-b border-slate-100 ${i % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                      <td className="py-2.5 pr-4 font-semibold text-[var(--ink)] whitespace-nowrap align-top">
                        {row.readable_id}
                      </td>
                      <td className="py-2.5 pr-4 align-top whitespace-nowrap">{row.cliente_nome}</td>
                      <td className="py-2.5 pr-4 align-top font-medium text-slate-600 whitespace-nowrap">
                        {LAVORAZIONE_LABELS[row.tipo_lavorazione || ''] || row.tipo_lavorazione || '—'}
                      </td>
                      <td className="py-2.5 pr-4 align-top whitespace-nowrap text-slate-600">
                        {row.creato_da_nome}
                      </td>
                      <td className="py-2.5 align-top">
                        {row.note.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <div className="space-y-1">
                            {row.note.map((n, ni) => (
                              <div key={ni} className="text-xs">
                                <span className="font-semibold text-slate-600">{n.label}: </span>
                                <span className="text-slate-700 whitespace-pre-wrap">{n.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-slate-400">
                {rows.length} busta{rows.length !== 1 ? 'e' : ''} · data apertura{' '}
                {new Date(reportDate! + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
