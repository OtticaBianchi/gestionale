export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type Timeframe = 'week' | 'month' | 'quarter' | 'year'
type ErrorCategory = 'critico' | 'medio' | 'basso'
type ResolutionStatus = 'open' | 'in_progress' | 'resolved' | 'cannot_resolve'
type ProceduraFlag = 'procedura_presente' | 'procedura_imprecisa' | 'procedura_assente'
type ImpattoCliente = 'basso' | 'medio' | 'alto'
type AssegnazioneColpa =
  | 'persona'
  | 'cliente'
  | 'procedura'
  | 'organizzazione'
  | 'sistemico'
  | 'non_identificabile'

type AnalyticsRow = {
  id: string
  error_type: string
  error_category: ErrorCategory
  cost_amount: number | null
  resolution_status: ResolutionStatus | null
  client_impacted: boolean | null
  is_draft: boolean
  reported_at: string
  step_workflow: string | null
  procedura_flag: ProceduraFlag | null
  impatto_cliente: ImpattoCliente | null
  assegnazione_colpa: AssegnazioneColpa | null
  creato_da_followup: boolean | null
  employee: {
    full_name: string | null
  } | null
}

type BucketStat = {
  key: string
  label: string
  count: number
  cost: number
  criticalCount: number
}

const STEP_LABELS: Record<string, string> = {
  accoglienza: 'Accoglienza',
  pre_controllo: 'Pre-Controllo',
  sala_controllo: 'Sala Controllo',
  preventivo_vendita: 'Preventivo / Vendita',
  ordine_materiali: 'Ordine Materiali',
  lavorazione: 'Lavorazione',
  controllo_qualita: 'Controllo Qualita',
  consegna: 'Consegna',
  post_vendita: 'Post-Vendita',
  follow_up: 'Follow-Up',
}

const PROCEDURA_LABELS: Record<string, string> = {
  procedura_presente: 'Procedura presente',
  procedura_imprecisa: 'Procedura imprecisa',
  procedura_assente: 'Procedura assente',
}

const IMPATTO_LABELS: Record<string, string> = {
  basso: 'Basso',
  medio: 'Medio',
  alto: 'Alto',
}

const ASSEGNAZIONE_LABELS: Record<string, string> = {
  persona: 'Persona',
  cliente: 'Cliente',
  procedura: 'Procedura',
  organizzazione: 'Organizzazione',
  sistemico: 'Sistemico',
  non_identificabile: 'Non identificabile',
}

const ERROR_TYPE_LABELS: Record<string, string> = {
  anagrafica_cliente: 'Anagrafica Cliente',
  busta_creation: 'Gestione Buste',
  materiali_ordine: 'Ordini Materiali',
  comunicazione_cliente: 'Comunicazione Cliente',
  misurazioni_vista: 'Controllo Vista',
  controllo_qualita: 'Controllo Qualita',
  consegna_prodotto: 'Consegna',
  gestione_pagamenti: 'Pagamenti',
  voice_note_processing: 'Note Vocali',
  post_vendita: 'Post-Vendita',
  altro: 'Altro',
}

const UNKNOWN_KEY = '__unknown__'

const getDateRange = (timeframe: Timeframe) => {
  const now = new Date()

  switch (timeframe) {
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    case 'quarter':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
    case 'year':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  }
}

const getWeekBucketStart = (date: Date) => {
  const normalized = new Date(date)
  const day = normalized.getDay()
  const diff = day === 0 ? -6 : 1 - day
  normalized.setDate(normalized.getDate() + diff)
  normalized.setHours(0, 0, 0, 0)
  return normalized
}

const createBucketMap = (
  rows: AnalyticsRow[],
  getBucketKey: (row: AnalyticsRow) => string | null,
  getBucketLabel: (key: string) => string
) => {
  const stats = new Map<string, BucketStat>()

  for (const row of rows) {
    const key = getBucketKey(row) || UNKNOWN_KEY
    const label = getBucketLabel(key)
    const current = stats.get(key) ?? {
      key,
      label,
      count: 0,
      cost: 0,
      criticalCount: 0,
    }

    current.count += 1
    current.cost += row.cost_amount ?? 0
    if (row.error_category === 'critico') current.criticalCount += 1
    stats.set(key, current)
  }

  return Array.from(stats.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return b.cost - a.cost
  })
}

const buildTrend = (rows: AnalyticsRow[], timeframe: Timeframe) => {
  const stats = new Map<string, BucketStat>()
  const useMonthlyBuckets = timeframe === 'quarter' || timeframe === 'year'

  for (const row of rows) {
    const date = new Date(row.reported_at)
    if (Number.isNaN(date.getTime())) continue

    const bucketDate = useMonthlyBuckets
      ? new Date(date.getFullYear(), date.getMonth(), 1)
      : timeframe === 'month'
      ? getWeekBucketStart(date)
      : new Date(date.getFullYear(), date.getMonth(), date.getDate())

    const key = bucketDate.toISOString().slice(0, 10)
    const label = useMonthlyBuckets
      ? bucketDate.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' })
      : timeframe === 'month'
      ? `Settimana ${bucketDate.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}`
      : bucketDate.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })

    const current = stats.get(key) ?? {
      key,
      label,
      count: 0,
      cost: 0,
      criticalCount: 0,
    }

    current.count += 1
    current.cost += row.cost_amount ?? 0
    if (row.error_category === 'critico') current.criticalCount += 1
    stats.set(key, current)
  }

  return Array.from(stats.values()).sort((a, b) => a.key.localeCompare(b.key))
}

const topSlice = (items: BucketStat[], limit = 8) => items.slice(0, limit)

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (!user || authError) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profilo non trovato' }, { status: 404 })
    }

    if (profile.role !== 'admin') {
      return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
    }

    const timeframe = (searchParams.get('timeframe') || 'month') as Timeframe
    const error_category = searchParams.get('error_category')
    const resolution_status = searchParams.get('resolution_status')
    const step_workflow = searchParams.get('step_workflow')
    const procedura_flag = searchParams.get('procedura_flag')
    const impatto_cliente = searchParams.get('impatto_cliente')
    const assegnazione_colpa = searchParams.get('assegnazione_colpa')
    const includeDrafts = searchParams.get('include_drafts') === 'true'

    const adminClient = (await import('@supabase/supabase-js')).createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let query = adminClient
      .from('error_tracking')
      .select(`
        id,
        error_type,
        error_category,
        cost_amount,
        resolution_status,
        client_impacted,
        is_draft,
        reported_at,
        step_workflow,
        procedura_flag,
        impatto_cliente,
        assegnazione_colpa,
        creato_da_followup,
        employee:profiles!error_tracking_employee_id_fkey(
          full_name
        )
      `)
      .gte('reported_at', getDateRange(timeframe))
      .order('reported_at', { ascending: false })

    if (!includeDrafts) query = query.eq('is_draft', false)
    if (error_category) query = query.eq('error_category', error_category)
    if (resolution_status) query = query.eq('resolution_status', resolution_status)
    if (step_workflow) query = query.eq('step_workflow', step_workflow)
    if (procedura_flag) query = query.eq('procedura_flag', procedura_flag)
    if (impatto_cliente) query = query.eq('impatto_cliente', impatto_cliente)
    if (assegnazione_colpa) query = query.eq('assegnazione_colpa', assegnazione_colpa)

    const { data, error } = await query

    if (error) {
      console.error('Error fetching analytics data:', error)
      return NextResponse.json({ error: 'Errore caricamento analytics errori' }, { status: 500 })
    }

    const rows = ((data ?? []) as unknown[]).map((rawRow) => {
      const row = rawRow as AnalyticsRow & { employee?: { full_name: string | null }[] | { full_name: string | null } | null }
      const employee = Array.isArray(row.employee) ? row.employee[0] ?? null : row.employee ?? null

      return {
        ...row,
        employee,
        cost_amount: row.cost_amount ?? 0,
      }
    })

    const totalCost = rows.reduce((sum, row) => sum + (row.cost_amount ?? 0), 0)
    const criticalCount = rows.filter((row) => row.error_category === 'critico').length
    const resolvedCount = rows.filter((row) => row.resolution_status === 'resolved').length
    const highImpactCount = rows.filter((row) => row.impatto_cliente === 'alto').length
    const clientImpactedCount = rows.filter((row) => row.client_impacted).length
    const procedureGapCount = rows.filter((row) =>
      row.procedura_flag === 'procedura_imprecisa' || row.procedura_flag === 'procedura_assente'
    ).length
    const systemicCount = rows.filter((row) => row.assegnazione_colpa === 'sistemico').length
    const followUpCount = rows.filter((row) => row.creato_da_followup).length
    const draftCount = rows.filter((row) => row.is_draft).length

    const byStep = createBucketMap(
      rows,
      (row) => row.step_workflow,
      (key) => (key === UNKNOWN_KEY ? 'Non classificato' : STEP_LABELS[key] || key)
    )

    const byProcedura = createBucketMap(
      rows,
      (row) => row.procedura_flag,
      (key) => (key === UNKNOWN_KEY ? 'Non classificato' : PROCEDURA_LABELS[key] || key)
    )

    const byImpatto = createBucketMap(
      rows,
      (row) => row.impatto_cliente,
      (key) => (key === UNKNOWN_KEY ? 'Non classificato' : IMPATTO_LABELS[key] || key)
    )

    const byAssegnazione = createBucketMap(
      rows,
      (row) => row.assegnazione_colpa,
      (key) => (key === UNKNOWN_KEY ? 'Non classificato' : ASSEGNAZIONE_LABELS[key] || key)
    )

    const byType = createBucketMap(
      rows,
      (row) => row.error_type,
      (key) => ERROR_TYPE_LABELS[key] || key
    )

    const byEmployee = createBucketMap(
      rows,
      (row) => row.employee?.full_name || UNKNOWN_KEY,
      (key) => (key === UNKNOWN_KEY ? 'Autore sconosciuto/a' : key)
    )

    const procedureDebtByStep = createBucketMap(
      rows.filter((row) =>
        row.procedura_flag === 'procedura_imprecisa' || row.procedura_flag === 'procedura_assente'
      ),
      (row) => row.step_workflow,
      (key) => (key === UNKNOWN_KEY ? 'Non classificato' : STEP_LABELS[key] || key)
    )

    const openProcedureDebt = rows.filter((row) =>
      row.resolution_status !== 'resolved' &&
      (row.procedura_flag === 'procedura_imprecisa' || row.procedura_flag === 'procedura_assente')
    ).length

    const openHighImpact = rows.filter(
      (row) => row.resolution_status !== 'resolved' && row.impatto_cliente === 'alto'
    ).length

    const openSystemic = rows.filter(
      (row) => row.resolution_status !== 'resolved' && row.assegnazione_colpa === 'sistemico'
    ).length

    const trend = buildTrend(rows, timeframe)

    return NextResponse.json({
      success: true,
      summary: {
        total_errors: rows.length,
        total_cost: totalCost,
        avg_cost: rows.length > 0 ? totalCost / rows.length : 0,
        critical_count: criticalCount,
        resolved_rate: rows.length > 0 ? resolvedCount / rows.length : 0,
        high_impact_count: highImpactCount,
        client_impacted_count: clientImpactedCount,
        procedure_gap_count: procedureGapCount,
        systemic_count: systemicCount,
        follow_up_count: followUpCount,
        draft_count: draftCount,
        open_high_impact_count: openHighImpact,
        open_procedure_debt_count: openProcedureDebt,
        open_systemic_count: openSystemic,
      },
      breakdowns: {
        by_step: byStep,
        by_procedura: byProcedura,
        by_impatto: byImpatto,
        by_assegnazione: byAssegnazione,
        by_type: topSlice(byType),
        by_employee: topSlice(byEmployee, 10),
        procedure_debt_by_step: topSlice(procedureDebtByStep),
        trend,
      },
      filters: {
        timeframe,
        error_category: error_category || '',
        resolution_status: resolution_status || '',
        step_workflow: step_workflow || '',
        procedura_flag: procedura_flag || '',
        impatto_cliente: impatto_cliente || '',
        assegnazione_colpa: assegnazione_colpa || '',
        include_drafts: includeDrafts,
      },
      meta: {
        fetched_rows: rows.length,
        payload_mode: 'aggregated',
      },
    })
  } catch (error) {
    console.error('Error in GET /api/error-tracking/analytics:', error)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}
