'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  ClipboardList,
  Filter,
  Layers3,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useUser } from '@/context/UserContext'

type BucketStat = {
  key: string
  label: string
  count: number
  cost: number
  criticalCount: number
}

type AnalyticsResponse = {
  success: boolean
  summary: {
    total_errors: number
    total_cost: number
    avg_cost: number
    critical_count: number
    resolved_rate: number
    high_impact_count: number
    client_impacted_count: number
    procedure_gap_count: number
    systemic_count: number
    follow_up_count: number
    draft_count: number
    open_high_impact_count: number
    open_procedure_debt_count: number
    open_systemic_count: number
  }
  breakdowns: {
    by_step: BucketStat[]
    by_procedura: BucketStat[]
    by_impatto: BucketStat[]
    by_assegnazione: BucketStat[]
    by_type: BucketStat[]
    by_employee: BucketStat[]
    procedure_debt_by_step: BucketStat[]
    trend: BucketStat[]
  }
  filters: AnalyticsFilters
  meta: {
    fetched_rows: number
    payload_mode: string
  }
  error?: string
}

type AnalyticsFilters = {
  timeframe: 'week' | 'month' | 'quarter' | 'year'
  error_category: string
  resolution_status: string
  step_workflow: string
  procedura_flag: string
  impatto_cliente: string
  assegnazione_colpa: string
  include_drafts: boolean
}

const DEFAULT_FILTERS: AnalyticsFilters = {
  timeframe: 'month',
  error_category: '',
  resolution_status: '',
  step_workflow: '',
  procedura_flag: '',
  impatto_cliente: '',
  assegnazione_colpa: '',
  include_drafts: false,
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value || 0)

const formatPercent = (value: number) => `${Math.round((value || 0) * 100)}%`

function BreakdownCard({
  title,
  subtitle,
  data,
  emptyLabel,
}: {
  title: string
  subtitle: string
  data: BucketStat[]
  emptyLabel: string
}) {
  const maxCount = Math.max(...data.map((item) => item.count), 1)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
      </div>

      <div className="p-5 space-y-4">
        {data.length === 0 && (
          <p className="text-sm text-gray-500">{emptyLabel}</p>
        )}

        {data.map((item) => (
          <div key={item.key} className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500">
                  {item.count} errori · {formatCurrency(item.cost)}
                  {item.criticalCount > 0 ? ` · ${item.criticalCount} critici` : ''}
                </p>
              </div>
              <span className="text-sm font-semibold text-gray-700">{item.count}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-slate-800"
                style={{ width: `${Math.max((item.count / maxCount) * 100, 4)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TrendCard({ data }: { data: BucketStat[] }) {
  const maxCount = Math.max(...data.map((item) => item.count), 1)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">Trend Errori</h2>
        <p className="text-sm text-gray-500 mt-1">Andamento del volume e del costo nel periodo selezionato.</p>
      </div>

      <div className="p-5">
        {data.length === 0 ? (
          <p className="text-sm text-gray-500">Nessun dato disponibile per il trend.</p>
        ) : (
          <div className="space-y-3">
            {data.map((item) => (
              <div key={item.key} className="grid grid-cols-[120px_1fr_120px] items-center gap-4">
                <span className="text-sm text-gray-600">{item.label}</span>
                <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${Math.max((item.count / maxCount) * 100, 4)}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 text-right">
                  {item.count} · {formatCurrency(item.cost)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ErrorAnalyticsPage() {
  const { profile, isLoading } = useUser()
  const isAdmin = profile?.role === 'admin'

  const [draftFilters, setDraftFilters] = useState<AnalyticsFilters>(DEFAULT_FILTERS)
  const [filters, setFilters] = useState<AnalyticsFilters>(DEFAULT_FILTERS)
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set('timeframe', filters.timeframe)

    if (filters.error_category) params.set('error_category', filters.error_category)
    if (filters.resolution_status) params.set('resolution_status', filters.resolution_status)
    if (filters.step_workflow) params.set('step_workflow', filters.step_workflow)
    if (filters.procedura_flag) params.set('procedura_flag', filters.procedura_flag)
    if (filters.impatto_cliente) params.set('impatto_cliente', filters.impatto_cliente)
    if (filters.assegnazione_colpa) params.set('assegnazione_colpa', filters.assegnazione_colpa)
    if (filters.include_drafts) params.set('include_drafts', 'true')

    return params.toString()
  }, [filters])

  const fetchAnalytics = async () => {
    if (!isAdmin) return

    setLoading(true)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/error-tracking/analytics?${queryString}`, {
        cache: 'no-store',
      })
      const payload = (await response.json()) as AnalyticsResponse

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Errore nel caricamento analytics')
      }

      setData(payload)
    } catch (error: any) {
      console.error('Errore caricamento analytics errori:', error)
      setErrorMessage(error.message || 'Errore inatteso durante il caricamento')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoading && isAdmin) {
      void fetchAnalytics()
    }
  }, [isLoading, isAdmin, queryString])

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md bg-white border border-gray-200 rounded-lg p-6 text-center shadow-sm">
          <ShieldAlert className="w-12 h-12 mx-auto text-red-500 mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Accesso riservato</h1>
          <p className="text-sm text-gray-600 mb-4">
            La pagina analytics errori è disponibile solo per gli amministratori.
          </p>
          <Link
            href="/errori"
            className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Torna a Tracciamento Errori
          </Link>
        </div>
      </div>
    )
  }

  const summary = data?.summary
  const breakdowns = data?.breakdowns

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/errori"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Tracciamento Errori</span>
              </Link>
              <div className="h-6 w-px bg-gray-300 hidden sm:block" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <BarChart3 className="w-7 h-7 text-slate-700" />
                  Analytics Errori
                </h1>
                <p className="text-sm text-gray-600">
                  Vista ET2 per analizzare trend, priorita e aree critiche.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void fetchAnalytics()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Aggiorna
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setFilters(draftFilters)
          }}
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-5"
        >
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">Filtri Analytics</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-gray-700">Periodo</span>
              <select
                value={draftFilters.timeframe}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, timeframe: e.target.value as AnalyticsFilters['timeframe'] }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="week">Ultima settimana</option>
                <option value="month">Ultimo mese</option>
                <option value="quarter">Ultimi 3 mesi</option>
                <option value="year">Ultimo anno</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-gray-700">Gravita</span>
              <select
                value={draftFilters.error_category}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, error_category: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Tutte</option>
                <option value="critico">Critico</option>
                <option value="medio">Medio</option>
                <option value="basso">Basso</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-gray-700">Stato risoluzione</span>
              <select
                value={draftFilters.resolution_status}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, resolution_status: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Tutti</option>
                <option value="open">Aperto</option>
                <option value="in_progress">In corso</option>
                <option value="resolved">Risolto</option>
                <option value="cannot_resolve">Non risolvibile</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-gray-700">Fase workflow</span>
              <select
                value={draftFilters.step_workflow}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, step_workflow: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Tutte</option>
                <option value="accoglienza">Accoglienza</option>
                <option value="pre_controllo">Pre-Controllo</option>
                <option value="sala_controllo">Sala Controllo</option>
                <option value="preventivo_vendita">Preventivo / Vendita</option>
                <option value="ordine_materiali">Ordine Materiali</option>
                <option value="lavorazione">Lavorazione</option>
                <option value="controllo_qualita">Controllo Qualita</option>
                <option value="consegna">Consegna</option>
                <option value="post_vendita">Post-Vendita</option>
                <option value="follow_up">Follow-Up</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-gray-700">Stato procedura</span>
              <select
                value={draftFilters.procedura_flag}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, procedura_flag: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Tutti</option>
                <option value="procedura_presente">Procedura presente</option>
                <option value="procedura_imprecisa">Procedura imprecisa</option>
                <option value="procedura_assente">Procedura assente</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-gray-700">Impatto cliente</span>
              <select
                value={draftFilters.impatto_cliente}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, impatto_cliente: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Tutti</option>
                <option value="alto">Alto</option>
                <option value="medio">Medio</option>
                <option value="basso">Basso</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-gray-700">Assegnazione colpa</span>
              <select
                value={draftFilters.assegnazione_colpa}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, assegnazione_colpa: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Tutte</option>
                <option value="persona">Persona</option>
                <option value="cliente">Cliente</option>
                <option value="procedura">Procedura</option>
                <option value="organizzazione">Organizzazione</option>
                <option value="sistemico">Sistemico</option>
                <option value="non_identificabile">Non identificabile</option>
              </select>
            </label>

            <label className="flex items-end gap-3 pb-2 text-sm">
              <input
                type="checkbox"
                checked={draftFilters.include_drafts}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, include_drafts: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="font-medium text-gray-700">Includi bozze automatiche</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Filter className="w-4 h-4" />
              Applica filtri
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftFilters(DEFAULT_FILTERS)
                setFilters(DEFAULT_FILTERS)
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Reset
            </button>
          </div>
        </form>

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {summary && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Errori analizzati</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{summary.total_errors}</p>
                  </div>
                  <ClipboardList className="w-8 h-8 text-gray-400" />
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Costo totale</p>
                    <p className="text-3xl font-bold text-red-600 mt-1">{formatCurrency(summary.total_cost)}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Costo medio</p>
                    <p className="text-3xl font-bold text-orange-600 mt-1">{formatCurrency(summary.avg_cost)}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-orange-400" />
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Tasso risoluzione</p>
                    <p className="text-3xl font-bold text-emerald-600 mt-1">{formatPercent(summary.resolved_rate)}</p>
                  </div>
                  <ShieldAlert className="w-8 h-8 text-emerald-400" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p className="text-sm text-gray-500">Errori critici</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{summary.critical_count}</p>
                <p className="text-xs text-gray-500 mt-2">Volume errori ad alta severita.</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p className="text-sm text-gray-500">Debito procedurale aperto</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{summary.open_procedure_debt_count}</p>
                <p className="text-xs text-gray-500 mt-2">Errori aperti con procedura imprecisa o assente.</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p className="text-sm text-gray-500">Alto impatto aperti</p>
                <p className="text-2xl font-bold text-fuchsia-700 mt-1">{summary.open_high_impact_count}</p>
                <p className="text-xs text-gray-500 mt-2">Errori non risolti con impatto cliente alto.</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p className="text-sm text-gray-500">Sistemici aperti</p>
                <p className="text-2xl font-bold text-slate-700 mt-1">{summary.open_systemic_count}</p>
                <p className="text-xs text-gray-500 mt-2">Errori non risolti classificati come sistemici.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="text-base font-semibold text-gray-900">Indicatori ET2</h2>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-600">Impatto cliente alto</span>
                    <span className="font-semibold text-gray-900">{summary.high_impact_count}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-600">Cliente impattato</span>
                    <span className="font-semibold text-gray-900">{summary.client_impacted_count}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-600">Gap procedurali</span>
                    <span className="font-semibold text-gray-900">{summary.procedure_gap_count}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-600">Classificati sistemici</span>
                    <span className="font-semibold text-gray-900">{summary.systemic_count}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-600">Creati da follow-up</span>
                    <span className="font-semibold text-gray-900">{summary.follow_up_count}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-600">Bozze incluse</span>
                    <span className="font-semibold text-gray-900">{summary.draft_count}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Layers3 className="w-5 h-5 text-slate-700" />
                  Lettura rapida
                </h2>
                <div className="mt-4 space-y-3 text-sm text-gray-700">
                  <p>
                    Se il debito procedurale e alto, la priorita non e la singola persona ma la procedura o l&apos;organizzazione.
                  </p>
                  <p>
                    Se gli errori sistemici aperti crescono, conviene intervenire sul flusso operativo prima di fare solo coaching individuale.
                  </p>
                  <p>
                    Se l&apos;impatto cliente alto si concentra in poche fasi, quelle sono le aree da mettere sotto controllo per prime.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <BreakdownCard
                title="Distribuzione per Fase"
                subtitle="Dove si concentrano gli errori nel workflow."
                data={breakdowns?.by_step ?? []}
                emptyLabel="Nessuna fase disponibile per i filtri selezionati."
              />
              <BreakdownCard
                title="Debito Procedurale per Fase"
                subtitle="Fasi con errori legati a procedura imprecisa o assente."
                data={breakdowns?.procedure_debt_by_step ?? []}
                emptyLabel="Nessun debito procedurale rilevato nel periodo."
              />
              <BreakdownCard
                title="Assegnazione Colpa"
                subtitle="Distribuzione ET2 per persona, procedura, organizzazione o sistema."
                data={breakdowns?.by_assegnazione ?? []}
                emptyLabel="Nessuna assegnazione disponibile."
              />
              <BreakdownCard
                title="Impatto Cliente"
                subtitle="Quanto pesano gli errori sul cliente finale."
                data={breakdowns?.by_impatto ?? []}
                emptyLabel="Nessun dato di impatto cliente disponibile."
              />
              <BreakdownCard
                title="Top Tipologie"
                subtitle="Categorie piu frequenti o costose nel periodo."
                data={breakdowns?.by_type ?? []}
                emptyLabel="Nessuna tipologia disponibile."
              />
              <BreakdownCard
                title="Operatori più Esposti"
                subtitle="Classifica operativa per volume e costo degli errori."
                data={breakdowns?.by_employee ?? []}
                emptyLabel="Nessun operatore disponibile."
              />
            </div>

            <TrendCard data={breakdowns?.trend ?? []} />
          </>
        )}
      </div>
    </div>
  )
}
