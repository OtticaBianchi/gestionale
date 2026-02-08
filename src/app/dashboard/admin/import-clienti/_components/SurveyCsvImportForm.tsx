'use client'

import { useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react'

type SurveyImportSummary = {
  batchId: string | null
  totalRows: number | null
  parsedRows: number | null
  matchedHigh: number | null
  matchedMedium: number | null
  matchedLow: number | null
  unmatched: number | null
  needsReview: number | null
  followupsPending: number | null
}

type SurveyImportResponse = {
  success: boolean
  dryRun: boolean
  autoMergeOrthographic: boolean
  summary: SurveyImportSummary
  output: string
}

export default function SurveyCsvImportForm() {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isHistorical, setIsHistorical] = useState(false)
  const [dryRun, setDryRun] = useState(false)
  const [autoMergeOrthographic, setAutoMergeOrthographic] = useState(true)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SurveyImportResponse | null>(null)

  const handleSubmit = async () => {
    if (!file || isSubmitting) return

    setIsSubmitting(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('isHistorical', String(isHistorical))
    formData.append('dryRun', String(dryRun))
    formData.append('autoMergeOrthographic', String(autoMergeOrthographic))
    formData.append('notes', notes.trim())

    try {
      const response = await fetch('/api/admin/import-clienti/survey', {
        method: 'POST',
        body: formData
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Errore import survey')
      }

      setResult(payload as SurveyImportResponse)
    } catch (submitError: any) {
      setError(submitError?.message || 'Errore import survey')
    } finally {
      setIsSubmitting(false)
    }
  }

  const summary = result?.summary

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Import Survey CSV</h2>
        <p className="mt-1 text-sm text-slate-500">
          Carica il CSV delle risposte survey. Il matching e la deduplicazione ortografica vengono applicati automaticamente.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">File</p>
            <div
              onClick={() => fileRef.current?.click()}
              className="mt-2 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 hover:border-slate-500"
            >
              <Upload className="h-4 w-4 text-slate-500" />
              <span className="text-sm text-slate-700">
                {file ? file.name : 'Seleziona CSV survey'}
              </span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] || null
                setFile(nextFile)
                setResult(null)
                setError(null)
                event.target.value = ''
              }}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Modalità</p>
            <div className="mt-2 space-y-2 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={!isHistorical}
                  onChange={() => setIsHistorical(false)}
                />
                Nuove risposte (live)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={isHistorical}
                  onChange={() => setIsHistorical(true)}
                />
                Import storico
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Opzioni</p>
            <div className="mt-2 space-y-2 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(event) => setDryRun(event.target.checked)}
                />
                Dry-run (nessuna scrittura DB)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoMergeOrthographic}
                  onChange={(event) => setAutoMergeOrthographic(event.target.checked)}
                />
                Auto-merge duplicati ortografici
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Note batch (opzionale)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Es. Survey Febbraio 2026 - invio newsletter"
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!file || isSubmitting}
          className={`mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            !file || isSubmitting
              ? 'cursor-not-allowed bg-slate-200 text-slate-500'
              : 'bg-slate-900 text-white shadow-sm hover:bg-slate-800'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Import in corso...
            </>
          ) : (
            <>
              <FileSpreadsheet className="h-4 w-4" />
              Avvia import survey
            </>
          )}
        </button>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {result && summary && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-slate-900">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <h3 className="text-lg font-semibold">
              {result.dryRun ? 'Dry-run completato' : 'Import completato'}
            </h3>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard label="Totale righe" value={summary.totalRows} />
            <MetricCard label="Righe parse" value={summary.parsedRows} />
            <MetricCard label="Match high" value={summary.matchedHigh} />
            <MetricCard label="Match medium" value={summary.matchedMedium} />
            <MetricCard label="Match low" value={summary.matchedLow} />
            <MetricCard label="Unmatched" value={summary.unmatched} />
            <MetricCard label="Needs review" value={summary.needsReview} />
            <MetricCard label="Follow-up pending" value={summary.followupsPending} />
          </div>

          {summary.batchId && (
            <p className="mt-4 text-sm text-slate-700">
              Batch ID: <span className="font-mono text-xs">{summary.batchId}</span>
            </p>
          )}

          {result.output && (
            <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">Output tecnico</summary>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-slate-700">{result.output}</pre>
            </details>
          )}
        </section>
      )}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{typeof value === 'number' ? value : '—'}</p>
    </div>
  )
}
