export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { shouldArchiveBusta } from '@/lib/buste/archiveRules'

type SearchType = 'all' | 'cliente' | 'prodotto' | 'fornitore'

type SearchContext = {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
  searchTerm: string
  includeArchived: boolean
  isBustaArchived: (busta: any) => boolean
}

type SearchResult = Record<string, unknown>
type SurveyParticipation = 'all' | 'yes' | 'no'

type SurveyFilterContext = {
  enabled: boolean
  participation: SurveyParticipation
  allParticipantIds: Set<string>
  matchingParticipantIds: Set<string>
}

const CATEGORY_MAP: Record<string, string[]> = {
  lenti: ['LENTI'],
  lente: ['LENTI'],
  lac: ['LAC'],
  montature: ['MONTATURE'],
  montatura: ['MONTATURE'],
  laboratorio: ['LABORATORIO'],
  lab: ['LABORATORIO'],
  sport: ['SPORT'],
}

const normalizeSearchValue = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const matchesWordStart = (value: string | null | undefined, term: string) => {
  if (!value || !term) return false
  const normalizedValue = normalizeSearchValue(value)
  const normalizedTerm = normalizeSearchValue(term)
  if (!normalizedValue || !normalizedTerm) return false
  const regex = new RegExp(`(^|[\\s\\-'/,\\.])${escapeRegex(normalizedTerm)}`, 'i')
  return regex.test(normalizedValue)
}

const getClientSearchScore = (
  cliente: { nome?: string | null; cognome?: string | null },
  term: string
) => {
  const normalizedTerm = normalizeSearchValue(term)
  const normalizedNome = normalizeSearchValue(cliente.nome || '')
  const normalizedCognome = normalizeSearchValue(cliente.cognome || '')

  if (!normalizedTerm) return 99
  if (normalizedCognome === normalizedTerm) return 0
  if (normalizedNome === normalizedTerm) return 1
  if (normalizedCognome.startsWith(normalizedTerm)) return 2
  if (normalizedNome.startsWith(normalizedTerm)) return 3
  if (matchesWordStart(cliente.cognome, term)) return 4
  if (matchesWordStart(cliente.nome, term)) return 5
  if (normalizedCognome.includes(normalizedTerm)) return 6
  if (normalizedNome.includes(normalizedTerm)) return 7
  return 99
}

const BUSTA_ARCHIVE_FIELDS = `
  id, readable_id, stato_attuale, data_apertura, updated_at, deleted_at,
  tipo_lavorazione, priorita, note_generali,
  info_pagamenti (
    is_saldato,
    modalita_saldo,
    note_pagamento,
    prezzo_finale,
    importo_acconto,
    data_saldo,
    updated_at
  ),
  payment_plan:payment_plans (
    id,
    total_amount,
    acconto,
    payment_type,
    is_completed,
    created_at,
    updated_at,
    payment_installments (
      id,
      paid_amount,
      is_completed,
      updated_at
    )
  ),
  clienti (id, nome, cognome, telefono)
`

async function searchClients(ctx: SearchContext, forceIncludeEmpty = false): Promise<SearchResult[]> {
  const { supabase, searchTerm, includeArchived, isBustaArchived } = ctx
  const normalizedTerm = searchTerm.trim()
  const selectFields = `
    id, nome, cognome, telefono, email, genere, note_cliente, updated_at,
    buste (
      ${BUSTA_ARCHIVE_FIELDS}
    )
  `
  const [cognomeRes, nomeRes] = await Promise.all([
    supabase
      .from('clienti')
      .select(selectFields)
      .is('deleted_at', null)
      .ilike('cognome', `%${normalizedTerm}%`)
      .order('cognome')
      .limit(200),
    supabase
      .from('clienti')
      .select(selectFields)
      .is('deleted_at', null)
      .ilike('nome', `%${normalizedTerm}%`)
      .order('cognome')
      .limit(200),
  ])

  if (cognomeRes.error || nomeRes.error) return []
  const combinedClienti = [...(cognomeRes.data || []), ...(nomeRes.data || [])]
  const uniqueClienti = Array.from(
    combinedClienti.reduce((acc, cliente: any) => {
      acc.set(cliente.id, cliente)
      return acc
    }, new Map<string, any>()).values()
  )
  const filteredClienti = uniqueClienti
    .map((cliente: any) => ({
      cliente,
      score: getClientSearchScore(cliente, normalizedTerm),
      updatedAtMs: cliente.updated_at ? new Date(cliente.updated_at).getTime() : 0,
    }))
    .filter(({ score }) => score < 99)
    .sort((a: any, b: any) => {
      if (a.score !== b.score) return a.score - b.score
      if (a.updatedAtMs !== b.updatedAtMs) return b.updatedAtMs - a.updatedAtMs
      const cognomeA = (a.cliente.cognome || '').toLowerCase()
      const cognomeB = (b.cliente.cognome || '').toLowerCase()
      if (cognomeA !== cognomeB) return cognomeA.localeCompare(cognomeB)
      return (a.cliente.nome || '').toLowerCase().localeCompare((b.cliente.nome || '').toLowerCase())
    })
    .slice(0, 50)
    .map(({ cliente }: any) => cliente)

  return filteredClienti.reduce<SearchResult[]>((acc, cliente) => {
    const buste = cliente.buste?.filter((busta: any) => {
      if (busta.deleted_at) return false
      const archived = isBustaArchived(busta)
      return includeArchived || !archived
    }) || []

    if (buste.length > 0 || forceIncludeEmpty) {
      acc.push({
        type: 'cliente',
        cliente,
        buste: buste.map((busta: any) => ({
          ...busta,
          isArchived: isBustaArchived(busta),
        })),
        matchField: 'nome/cognome',
      })
    }

    return acc
  }, [])
}

async function searchCategoryOrders(ctx: SearchContext, categoria: string): Promise<SearchResult[]> {
  const { supabase, includeArchived, isBustaArchived } = ctx
  const fieldMap: Record<string, string> = {
    LENTI: 'fornitore_lenti_id',
    LAC: 'fornitore_lac_id',
    MONTATURE: 'fornitore_montature_id',
    LABORATORIO: 'fornitore_lab_esterno_id',
    SPORT: 'fornitore_sport_id',
  }

  const campoFornitore = fieldMap[categoria]
  if (!campoFornitore) return []

  const { data, error } = await supabase
    .from('ordini_materiali')
    .select(`
      id, descrizione_prodotto, stato, note,
      buste!inner (
        ${BUSTA_ARCHIVE_FIELDS}
      )
    `)
    .is('deleted_at', null)
    .is('buste.deleted_at', null)
    .not(campoFornitore, 'is', null)
    .limit(30)

  if (error || !data) return []

  return data.reduce<SearchResult[]>((acc, ordine) => {
    if (!ordine.buste || ordine.buste.deleted_at) return acc
    const archived = isBustaArchived(ordine.buste)
    if (!includeArchived && archived) return acc

    acc.push({
      type: 'categoria',
      categoria,
      prodotto: {
        id: ordine.id,
        descrizione: ordine.descrizione_prodotto,
        stato: ordine.stato,
        note: ordine.note,
      },
      busta: {
        ...ordine.buste,
        isArchived: archived,
      },
      cliente: ordine.buste.clienti,
      matchField: `categoria ${categoria.toLowerCase()}`,
    })

    return acc
  }, [])
}

async function searchProducts(ctx: SearchContext): Promise<SearchResult[]> {
  const { supabase, searchTerm, includeArchived, isBustaArchived } = ctx
  const normalizedTerm = searchTerm.toLowerCase()
  const categories = CATEGORY_MAP[normalizedTerm] || []

  const categoryResults = await Promise.all(categories.map((categoria) => searchCategoryOrders(ctx, categoria)))

  const { data: materiali, error } = await supabase
    .from('materiali')
    .select(`
      id, tipo, codice_prodotto, fornitore, stato, note,
      buste!inner (
        ${BUSTA_ARCHIVE_FIELDS}
      )
    `)
    .is('buste.deleted_at', null)
    .or(`tipo.ilike.%${searchTerm}%,codice_prodotto.ilike.%${searchTerm}%,note.ilike.%${searchTerm}%`)
    .limit(30)

  const materialResults = (error || !materiali)
    ? []
    : materiali.reduce<SearchResult[]>((acc, materiale) => {
        if (!materiale.buste || materiale.buste.deleted_at) return acc
        const archived = isBustaArchived(materiale.buste)
        if (!includeArchived && archived) return acc

        acc.push({
          type: 'prodotto',
          prodotto: {
            id: materiale.id,
            descrizione: materiale.tipo,
            codice: materiale.codice_prodotto,
            fornitore: materiale.fornitore,
            note: materiale.note,
          },
          busta: {
            ...materiale.buste,
            isArchived: archived,
          },
          cliente: materiale.buste.clienti,
          matchField: 'materiale',
        })

        return acc
      }, [])

  return [...categoryResults.flat(), ...materialResults]
}

async function searchSuppliers(ctx: SearchContext): Promise<SearchResult[]> {
  const { supabase, searchTerm, includeArchived, isBustaArchived } = ctx

  const supplierTables = [
    { table: 'fornitori_lenti', key: 'fornitore_lenti_id', label: 'lenti' },
    { table: 'fornitori_lac', key: 'fornitore_lac_id', label: 'lac' },
    { table: 'fornitori_montature', key: 'fornitore_montature_id', label: 'montature' },
    { table: 'fornitori_sport', key: 'fornitore_sport_id', label: 'sport' },
    { table: 'fornitori_lab_esterno', key: 'fornitore_lab_esterno_id', label: 'lab_esterno' },
  ] as const

  const supplierPromises = supplierTables.map(async ({ table, key, label }) => {
    const { data, error } = await supabase
      .from(table)
      .select('id, nome, telefono, email, tempi_consegna_medi')
      .ilike('nome', `%${searchTerm}%`)
      .limit(5)

    if (error || !data) return [] as SearchResult[]

    const supplierIds = data.map((supplier) => supplier.id)
    if (supplierIds.length === 0) return [] as SearchResult[]

    const { data: ordini } = await supabase
      .from('ordini_materiali')
      .select(
        `id, descrizione_prodotto, stato, note, ${key},
        buste!inner (
          ${BUSTA_ARCHIVE_FIELDS}
        )`
      )
      .is('deleted_at', null)
      .is('buste.deleted_at', null)
      .in(key, supplierIds)
      .limit(50)

    if (!ordini) return [] as SearchResult[]

    const suppliersById = new Map(data.map((supplier) => [supplier.id, supplier]))

    return ordini.reduce<SearchResult[]>((acc, ordine) => {
      const supplierId = (ordine as any)[key]
      if (!supplierId) return acc

      const supplier = suppliersById.get(supplierId)
      if (!supplier || !ordine.buste || ordine.buste.deleted_at) return acc

      const archived = isBustaArchived(ordine.buste)
      if (!includeArchived && archived) return acc

      acc.push({
        type: 'fornitore',
        fornitore: {
          ...supplier,
          category: label,
        },
        busta: {
          ...ordine.buste,
          isArchived: archived,
        },
        prodotto: {
          id: ordine.id,
          descrizione: ordine.descrizione_prodotto,
          stato: ordine.stato,
          note: ordine.note,
        },
        cliente: ordine.buste.clienti,
        matchField: 'fornitore',
      })

      return acc
    }, [])
  })

  const supplierResults = await Promise.all(supplierPromises)
  return supplierResults.flat()
}

const HANDLERS: Record<Exclude<SearchType, 'all'>, (ctx: SearchContext) => Promise<SearchResult[]>> = {
  cliente: (ctx) => searchClients(ctx, true),
  prodotto: (ctx) => searchProducts(ctx),
  fornitore: (ctx) => searchSuppliers(ctx),
}

const asDayBoundIso = (value: string | null, bound: 'start' | 'end') => {
  if (!value) return null
  const normalized = value.trim()
  if (!normalized) return null
  return bound === 'start'
    ? `${normalized}T00:00:00.000Z`
    : `${normalized}T23:59:59.999Z`
}

const loadSurveyFilterContext = async (
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  params: {
    participation: SurveyParticipation
    badge: string | null
    scoreMin: number | null
    scoreMode: 'avg' | 'latest'
    lastFrom: string | null
    lastTo: string | null
  }
): Promise<SurveyFilterContext> => {
  const hasExtraFilters = Boolean(
    (params.badge && params.badge !== 'all') ||
    params.scoreMin !== null ||
    params.lastFrom ||
    params.lastTo
  )

  if (params.participation === 'all' && !hasExtraFilters) {
    return {
      enabled: false,
      participation: 'all',
      allParticipantIds: new Set(),
      matchingParticipantIds: new Set()
    }
  }

  const { data, error } = await (supabase as any)
    .from('survey_client_summary')
    .select('cliente_id, latest_badge_level, avg_overall_score, latest_overall_score, latest_response_at')

  if (error || !data) {
    throw new Error(`Errore recupero filtri survey: ${error?.message || 'unknown'}`)
  }

  const allParticipantIds = new Set<string>((data || []).map((row: any) => row.cliente_id).filter(Boolean))
  const fromIso = asDayBoundIso(params.lastFrom, 'start')
  const toIso = asDayBoundIso(params.lastTo, 'end')

  const filtered = (data || []).filter((row: any) => {
    if (params.badge && params.badge !== 'all' && row.latest_badge_level !== params.badge) return false

    if (params.scoreMin !== null) {
      const score = params.scoreMode === 'latest' ? row.latest_overall_score : row.avg_overall_score
      if (typeof score !== 'number' || score < params.scoreMin) return false
    }

    if (fromIso || toIso) {
      if (!row.latest_response_at) return false
      const responseTime = new Date(row.latest_response_at).getTime()
      if (!Number.isFinite(responseTime)) return false
      if (fromIso && responseTime < new Date(fromIso).getTime()) return false
      if (toIso && responseTime > new Date(toIso).getTime()) return false
    }

    return true
  })

  return {
    enabled: true,
    participation: params.participation,
    allParticipantIds,
    matchingParticipantIds: new Set(filtered.map((row: any) => row.cliente_id).filter(Boolean))
  }
}

const extractClientIdFromResult = (result: SearchResult): string | null => {
  const directCliente = (result as any).cliente
  if (directCliente?.id) return String(directCliente.id)

  const bustaCliente = (result as any).busta?.clienti
  if (bustaCliente?.id) return String(bustaCliente.id)

  const busteArray = (result as any).buste
  if (Array.isArray(busteArray) && busteArray.length > 0) {
    const first = busteArray[0]
    if (first?.clienti?.id) return String(first.clienti.id)
  }

  return null
}

const applySurveyFilterToResults = (
  results: SearchResult[],
  surveyFilters: SurveyFilterContext
) => {
  if (!surveyFilters.enabled) return results

  return results.filter((result) => {
    const clientId = extractClientIdFromResult(result)
    if (!clientId) return false

    if (surveyFilters.participation === 'no') {
      return !surveyFilters.allParticipantIds.has(clientId)
    }

    return surveyFilters.matchingParticipantIds.has(clientId)
  })
}

const mapClientRowsToResults = (
  clienti: any[],
  includeArchived: boolean,
  now: Date,
  matchField: string
): SearchResult[] => {
  return (clienti || []).map((cliente: any) => {
    const buste = (cliente.buste || [])
      .filter((busta: any) => !busta.deleted_at)
      .filter((busta: any) => includeArchived || !shouldArchiveBusta(busta, { now }))
      .map((busta: any) => ({
        ...busta,
        isArchived: shouldArchiveBusta(busta, { now })
      }))

    return {
      type: 'cliente' as const,
      cliente,
      buste,
      matchField
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    const query = searchParams.get('q')
    const type = (searchParams.get('type') || 'all') as SearchType
    const includeArchived = searchParams.get('includeArchived') === 'true'

    // ===== NEW FILTERS =====
    const bustaId = searchParams.get('bustaId')
    const priorita = searchParams.get('priorita')
    const tipoLavorazione = searchParams.get('tipoLavorazione')
    const fornitore = searchParams.get('fornitore')
    const categoria = searchParams.get('categoria')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const telefono = searchParams.get('telefono')
    const statoPagamento = searchParams.get('statoPagamento')
    const statoOrdine = searchParams.get('statoOrdine')
    const surveyParticipation = (searchParams.get('surveyParticipation') || 'all') as SurveyParticipation
    const surveyBadge = searchParams.get('surveyBadge')
    const surveyScoreMode = (searchParams.get('surveyScoreMode') || 'avg') as 'avg' | 'latest'
    const surveyScoreMinRaw = searchParams.get('surveyScoreMin')
    const surveyScoreMin = surveyScoreMinRaw && surveyScoreMinRaw.trim() !== ''
      ? Number.parseFloat(surveyScoreMinRaw)
      : null
    const surveyLastFrom = searchParams.get('surveyLastFrom')
    const surveyLastTo = searchParams.get('surveyLastTo')

    // Check if we have filters (allow search with just filters, no text query)
    const hasSurveyFilters = (
      surveyParticipation !== 'all' ||
      (surveyBadge && surveyBadge !== 'all') ||
      (surveyScoreMin !== null && Number.isFinite(surveyScoreMin)) ||
      Boolean(surveyLastFrom) ||
      Boolean(surveyLastTo)
    )

    const hasNonSurveyFilters = Boolean(
      bustaId ||
      priorita ||
      tipoLavorazione ||
      fornitore ||
      categoria ||
      dateFrom ||
      dateTo ||
      telefono ||
      statoPagamento ||
      statoOrdine
    )

    const hasFilters = bustaId || priorita || tipoLavorazione || fornitore || categoria || dateFrom || dateTo || telefono || statoPagamento || statoOrdine || hasSurveyFilters
    const hasTextQuery = query && query.trim().length >= 2

    if (!hasTextQuery && !hasFilters) {
      return NextResponse.json({ results: [] })
    }

    const searchTerm = query?.trim() || ''
    console.log('🔍 Advanced search:', {
      searchTerm,
      type,
      includeArchived,
      bustaId,
      priorita,
      tipoLavorazione,
      fornitore,
      categoria,
      dateFrom,
      dateTo,
      telefono,
      statoPagamento,
      statoOrdine,
      surveyParticipation,
      surveyBadge,
      surveyScoreMode,
      surveyScoreMin,
      surveyLastFrom,
      surveyLastTo
    })

    const now = new Date()
    const surveyFilters = await loadSurveyFilterContext(supabase, {
      participation: ['all', 'yes', 'no'].includes(surveyParticipation) ? surveyParticipation : 'all',
      badge: surveyBadge,
      scoreMin: surveyScoreMin !== null && Number.isFinite(surveyScoreMin) ? surveyScoreMin : null,
      scoreMode: surveyScoreMode === 'latest' ? 'latest' : 'avg',
      lastFrom: surveyLastFrom,
      lastTo: surveyLastTo
    })

    // ===== SURVEY-ONLY SEARCH (no text + no other filters) =====
    if (!hasTextQuery && hasSurveyFilters && !hasNonSurveyFilters) {
      const selectFields = `
        id, nome, cognome, telefono, email, genere, note_cliente,
        buste (
          ${BUSTA_ARCHIVE_FIELDS}
        )
      `

      if (surveyFilters.participation === 'no') {
        const { data: clienti } = await supabase
          .from('clienti')
          .select(selectFields)
          .is('deleted_at', null)
          .order('cognome')
          .order('nome')
          .limit(500)

        const mapped = mapClientRowsToResults(clienti || [], includeArchived, now, 'survey')
        const surveyFilteredResults = applySurveyFilterToResults(mapped, surveyFilters)
        return NextResponse.json({ results: surveyFilteredResults, total: surveyFilteredResults.length })
      }

      const participantIds = [...surveyFilters.matchingParticipantIds]
      if (participantIds.length === 0) {
        return NextResponse.json({ results: [], total: 0 })
      }

      const chunkSize = 200
      const clienti: any[] = []
      for (let index = 0; index < participantIds.length; index += chunkSize) {
        const chunk = participantIds.slice(index, index + chunkSize)
        const { data: chunkClienti } = await supabase
          .from('clienti')
          .select(selectFields)
          .is('deleted_at', null)
          .in('id', chunk)
        clienti.push(...(chunkClienti || []))
      }

      clienti.sort((a, b) => {
        const cognomeA = (a.cognome || '').toLowerCase()
        const cognomeB = (b.cognome || '').toLowerCase()
        if (cognomeA !== cognomeB) return cognomeA.localeCompare(cognomeB)
        const nomeA = (a.nome || '').toLowerCase()
        const nomeB = (b.nome || '').toLowerCase()
        return nomeA.localeCompare(nomeB)
      })

      const surveyResults = mapClientRowsToResults(clienti, includeArchived, now, 'survey')
      return NextResponse.json({ results: surveyResults, total: surveyResults.length })
    }

    // ===== PHONE NUMBER SEARCH (Direct lookup) =====
    if (telefono) {
      const { data: clienti } = await supabase
        .from('clienti')
        .select(`
          id, nome, cognome, telefono, email, genere,
          buste (
            ${BUSTA_ARCHIVE_FIELDS}
          )
        `)
        .is('deleted_at', null)
        .ilike('telefono', `%${telefono}%`)
        .limit(20)

      const phoneResults = (clienti || []).flatMap((cliente: any) => {
        const buste = (cliente.buste || [])
          .filter((busta: any) => !busta.deleted_at)
          .filter((busta: any) => includeArchived || !shouldArchiveBusta(busta, { now }))
          .map((busta: any) => ({
            ...busta,
            isArchived: shouldArchiveBusta(busta, { now })
          }))

        if (buste.length === 0) return []

        return [{
          type: 'cliente' as const,
          cliente,
          buste,
          matchField: 'telefono'
        }]
      })

      const surveyFilteredResults = applySurveyFilterToResults(phoneResults, surveyFilters)
      return NextResponse.json({ results: surveyFilteredResults, total: surveyFilteredResults.length })
    }

    // ===== BUSTA ID SEARCH (Direct lookup) =====
    if (bustaId) {
      const { data: buste } = await supabase
        .from('buste')
        .select(`
          ${BUSTA_ARCHIVE_FIELDS}
        `)
        .is('deleted_at', null)
        .ilike('readable_id', `%${bustaId}%`)
        .limit(20)

      const bustaResults = (buste || []).map((busta: any) => ({
        type: 'cliente' as const,
        cliente: busta.clienti,
        buste: [{
          id: busta.id,
          readable_id: busta.readable_id,
          stato_attuale: busta.stato_attuale,
          data_apertura: busta.data_apertura,
          isArchived: shouldArchiveBusta(busta, { now })
        }],
        matchField: 'busta ID'
      }))

      const surveyFilteredResults = applySurveyFilterToResults(bustaResults, surveyFilters)
      return NextResponse.json({ results: surveyFilteredResults, total: surveyFilteredResults.length })
    }

    // ===== FILTER-BASED SEARCH (for categoria/fornitore/statoOrdine, we need to query ordini_materiali) =====
    if (priorita || tipoLavorazione || categoria || fornitore || (dateFrom && dateTo) || statoPagamento || statoOrdine) {
      // If searching by categoria, fornitore, or statoOrdine, query ordini_materiali first
      if (categoria || fornitore || statoOrdine) {
        const categoriaFieldMap: Record<string, string> = {
          'LENTI': 'fornitore_lenti_id',
          'LAC': 'fornitore_lac_id',
          'MONTATURE': 'fornitore_montature_id',
          'LABORATORIO': 'fornitore_lab_esterno_id',
          'SPORT': 'fornitore_sport_id',
          'ACCESSORI': 'fornitore_lac_id', // Accessori uses LAC supplier table
          // ASSISTENZA and RICAMBI are filtered via categoria_fornitore field
        }

        let ordiniQuery = supabase
          .from('ordini_materiali')
          .select(`
            busta_id,
            categoria_fornitore,
            buste!inner (
              ${BUSTA_ARCHIVE_FIELDS}
            )
          `)
        ordiniQuery = ordiniQuery.is('deleted_at', null).is('buste.deleted_at', null)

        // Apply categoria filter
        if (categoria) {
          if (categoria === 'ASSISTENZA' || categoria === 'RICAMBI') {
            // For ASSISTENZA and RICAMBI, use categoria_fornitore field
            ordiniQuery = ordiniQuery.ilike('categoria_fornitore', `%${categoria.toLowerCase()}%`)
          } else if (categoriaFieldMap[categoria]) {
            // For standard categories, use fornitore foreign key
            ordiniQuery = ordiniQuery.not(categoriaFieldMap[categoria], 'is', null)
          }
        }

        // Apply fornitore filter (search across all fornitore fields)
        if (fornitore && fornitore !== 'all') {
          ordiniQuery = ordiniQuery.or(
            `fornitore_lenti_id.eq.${fornitore},fornitore_lac_id.eq.${fornitore},fornitore_montature_id.eq.${fornitore},fornitore_lab_esterno_id.eq.${fornitore},fornitore_sport_id.eq.${fornitore}`
          )
        }

        // Apply order status filter
        if (statoOrdine && statoOrdine !== 'all') {
          ordiniQuery = ordiniQuery.eq('stato', statoOrdine as any)
        }

        // Apply other busta-level filters through the join
        if (priorita) ordiniQuery = ordiniQuery.eq('buste.priorita', priorita as any)
        if (tipoLavorazione) ordiniQuery = ordiniQuery.eq('buste.tipo_lavorazione', tipoLavorazione as any)
        if (dateFrom && dateTo) {
          ordiniQuery = ordiniQuery.gte('buste.data_apertura', dateFrom).lte('buste.data_apertura', dateTo)
        }
        if (!includeArchived) {
          ordiniQuery = ordiniQuery.neq('buste.stato_attuale', 'consegnato_pagato')
        }

        const { data: ordini } = await ordiniQuery.limit(50)

        const busteMap = new Map()
        ordini?.forEach((ordine: any) => {
          if (ordine.buste && !ordine.buste.deleted_at && !busteMap.has(ordine.buste.id)) {
            busteMap.set(ordine.buste.id, ordine.buste)
          }
        })

        const filteredResults = Array.from(busteMap.values()).map((busta: any) => ({
          type: 'cliente' as const,
          cliente: busta.clienti,
          buste: [{
            id: busta.id,
            readable_id: busta.readable_id,
            stato_attuale: busta.stato_attuale,
            data_apertura: busta.data_apertura,
            isArchived: shouldArchiveBusta(busta, { now })
          }],
          matchField: [priorita && 'priorità', tipoLavorazione && 'tipo lavorazione', categoria && 'categoria', fornitore && 'fornitore', statoOrdine && 'stato ordine', (dateFrom && dateTo) && 'periodo'].filter(Boolean).join(', ')
        }))

        const surveyFilteredResults = applySurveyFilterToResults(filteredResults, surveyFilters)
        return NextResponse.json({ results: surveyFilteredResults, total: surveyFilteredResults.length })
      }

      // If searching by payment status, query info_pagamenti
      if (statoPagamento && statoPagamento !== 'all') {
        let pagamentiQuery = supabase
          .from('info_pagamenti')
          .select(`
            id, importo_totale, totale_pagato, importo_acconto,
            buste!inner (
              ${BUSTA_ARCHIVE_FIELDS}
            )
          `)
        pagamentiQuery = pagamentiQuery.is('deleted_at', null).is('buste.deleted_at', null)

        // Apply other busta-level filters
        if (priorita) pagamentiQuery = pagamentiQuery.eq('buste.priorita', priorita as any)
        if (tipoLavorazione) pagamentiQuery = pagamentiQuery.eq('buste.tipo_lavorazione', tipoLavorazione as any)
        if (dateFrom && dateTo) {
          pagamentiQuery = pagamentiQuery.gte('buste.data_apertura', dateFrom).lte('buste.data_apertura', dateTo)
        }
        if (!includeArchived) {
          pagamentiQuery = pagamentiQuery.neq('buste.stato_attuale', 'consegnato_pagato')
        }

        const { data: pagamenti } = await pagamentiQuery.limit(200)

        // Filter by payment status in JavaScript (since Supabase can't compare columns)
        const filteredPagamenti = (pagamenti || []).filter((pagamento: any) => {
          const { importo_totale, totale_pagato, importo_acconto } = pagamento

          if (statoPagamento === 'pagato') {
            // Pagato: totale_pagato >= importo_totale
            return totale_pagato >= importo_totale
          } else if (statoPagamento === 'non_pagato') {
            // Non pagato: totale_pagato = 0
            return totale_pagato === 0
          } else if (statoPagamento === 'parziale') {
            // Parzialmente pagato: 0 < totale_pagato < importo_totale
            return totale_pagato > 0 && totale_pagato < importo_totale
          } else if (statoPagamento === 'saldo') {
            // Saldo da versare: has importo_acconto and not fully paid
            return importo_acconto > 0 && totale_pagato < importo_totale
          }
          return true
        })

        const paymentResults = filteredPagamenti.slice(0, 50).map((pagamento: any) => ({
          type: 'cliente' as const,
          cliente: pagamento.buste.clienti,
          buste: [{
            id: pagamento.buste.id,
            readable_id: pagamento.buste.readable_id,
            stato_attuale: pagamento.buste.stato_attuale,
            data_apertura: pagamento.buste.data_apertura,
            isArchived: shouldArchiveBusta(pagamento.buste, { now })
          }],
          matchField: [statoPagamento && 'stato pagamento', priorita && 'priorità', tipoLavorazione && 'tipo lavorazione', (dateFrom && dateTo) && 'periodo'].filter(Boolean).join(', ')
        }))

        const surveyFilteredResults = applySurveyFilterToResults(paymentResults, surveyFilters)
        return NextResponse.json({ results: surveyFilteredResults, total: surveyFilteredResults.length })
      }

      // Otherwise, query buste directly
      let query = supabase
        .from('buste')
        .select(`
          ${BUSTA_ARCHIVE_FIELDS}
        `)
      query = query.is('deleted_at', null)

      if (priorita) query = query.eq('priorita', priorita as any)
      if (tipoLavorazione) query = query.eq('tipo_lavorazione', tipoLavorazione as any)
      if (dateFrom && dateTo) {
        query = query.gte('data_apertura', dateFrom).lte('data_apertura', dateTo)
      }

      if (!includeArchived) {
        query = query.neq('stato_attuale', 'consegnato_pagato')
      }

      const { data: buste } = await query.order('data_apertura', { ascending: false}).limit(50)

      const filteredResults = (buste || []).map((busta: any) => ({
        type: 'cliente' as const,
        cliente: busta.clienti,
        buste: [{
          id: busta.id,
          readable_id: busta.readable_id,
          stato_attuale: busta.stato_attuale,
          data_apertura: busta.data_apertura,
          isArchived: shouldArchiveBusta(busta, { now })
        }],
        matchField: [priorita && 'priorità', tipoLavorazione && 'tipo lavorazione', (dateFrom && dateTo) && 'periodo'].filter(Boolean).join(', ')
      }))

      const surveyFilteredResults = applySurveyFilterToResults(filteredResults, surveyFilters)
      return NextResponse.json({ results: surveyFilteredResults, total: surveyFilteredResults.length })
    }

    // ===== ORIGINAL TEXT-BASED SEARCH =====
    const ctx: SearchContext = {
      supabase,
      searchTerm,
      includeArchived,
      isBustaArchived: (busta) => shouldArchiveBusta(busta, { now }),
    }

    const tasks: Promise<SearchResult[]>[] = []

    if (type === 'all') {
      // Include clients even when they have no non-archived buste so surname-only matches aren't dropped.
      tasks.push(searchClients(ctx, true), searchProducts(ctx), searchSuppliers(ctx))
    } else {
      const handler = HANDLERS[type]
      if (handler) {
        tasks.push(handler(ctx))
      }
    }

    const results = (await Promise.all(tasks)).flat()
    const surveyFilteredResults = applySurveyFilterToResults(results, surveyFilters)
    return NextResponse.json({ results: surveyFilteredResults, total: surveyFilteredResults.length })
  } catch (error: any) {
    console.error('❌ Advanced search error:', error)
    return NextResponse.json({ error: 'Errore nella ricerca avanzata' }, { status: 500 })
  }
}
