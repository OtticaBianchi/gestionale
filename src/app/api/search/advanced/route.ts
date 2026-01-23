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

const normalizeSearchValue = (value: string) => value.normalize('NFKD').replace(/\s+/g, ' ').trim()

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const matchesWordStart = (value: string | null | undefined, term: string) => {
  if (!value || !term) return false
  const normalizedValue = normalizeSearchValue(value)
  const normalizedTerm = normalizeSearchValue(term)
  if (!normalizedValue || !normalizedTerm) return false
  const regex = new RegExp(`(^|[\\s\\-'/,\\.])${escapeRegex(normalizedTerm)}`, 'i')
  return regex.test(normalizedValue)
}

async function searchClients(ctx: SearchContext, forceIncludeEmpty = false): Promise<SearchResult[]> {
  const { supabase, searchTerm, includeArchived, isBustaArchived } = ctx
  const normalizedTerm = searchTerm.trim()
  const selectFields = `
    id, nome, cognome, telefono, email, genere, note_cliente,
    buste (
      id, readable_id, stato_attuale, data_apertura, updated_at, deleted_at,
      tipo_lavorazione, priorita, note_generali
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
    .map((cliente: any) => {
      const cognomeMatch = matchesWordStart(cliente.cognome, normalizedTerm)
      const nomeMatch = matchesWordStart(cliente.nome, normalizedTerm)
      return { cliente, cognomeMatch, nomeMatch }
    })
    .filter(({ cognomeMatch, nomeMatch }) => cognomeMatch || nomeMatch)
    .sort((a: any, b: any) => {
      if (a.cognomeMatch !== b.cognomeMatch) return a.cognomeMatch ? -1 : 1
      const cognomeA = (a.cliente.cognome || '').toLowerCase()
      const cognomeB = (b.cliente.cognome || '').toLowerCase()
      if (cognomeA !== cognomeB) return cognomeA.localeCompare(cognomeB)
      return (a.cliente.nome || '').toLowerCase().localeCompare((b.cliente.nome || '').toLowerCase())
    })
    .slice(0, 20)
    .map(({ cliente }) => cliente)

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
        id, readable_id, stato_attuale, updated_at, data_apertura, deleted_at,
        clienti (id, nome, cognome)
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
        id, readable_id, stato_attuale, updated_at, data_apertura, deleted_at,
        clienti (id, nome, cognome)
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
          id, readable_id, stato_attuale, updated_at, data_apertura, deleted_at,
          clienti (id, nome, cognome)
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

    // Check if we have filters (allow search with just filters, no text query)
    const hasFilters = bustaId || priorita || tipoLavorazione || fornitore || categoria || dateFrom || dateTo || telefono || statoPagamento || statoOrdine
    const hasTextQuery = query && query.trim().length >= 2

    if (!hasTextQuery && !hasFilters) {
      return NextResponse.json({ results: [] })
    }

    const searchTerm = query?.trim() || ''
    console.log('🔍 Advanced search:', { searchTerm, type, includeArchived, bustaId, priorita, tipoLavorazione, fornitore, categoria, dateFrom, dateTo, telefono, statoPagamento, statoOrdine })

    const now = new Date()

    // ===== PHONE NUMBER SEARCH (Direct lookup) =====
    if (telefono) {
      const { data: clienti } = await supabase
        .from('clienti')
        .select(`
          id, nome, cognome, telefono, email, genere,
          buste (
            id, readable_id, stato_attuale, data_apertura, tipo_lavorazione, priorita, updated_at, deleted_at
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

      return NextResponse.json({ results: phoneResults, total: phoneResults.length })
    }

    // ===== BUSTA ID SEARCH (Direct lookup) =====
    if (bustaId) {
      const { data: buste } = await supabase
        .from('buste')
        .select(`
          id, readable_id, stato_attuale, data_apertura, tipo_lavorazione, priorita, updated_at,
          clienti (id, nome, cognome, telefono)
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

      return NextResponse.json({ results: bustaResults, total: bustaResults.length })
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
              id, readable_id, stato_attuale, data_apertura, tipo_lavorazione, priorita, updated_at, deleted_at,
              clienti (id, nome, cognome, telefono)
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

        return NextResponse.json({ results: filteredResults, total: filteredResults.length })
      }

      // If searching by payment status, query info_pagamenti
      if (statoPagamento && statoPagamento !== 'all') {
        let pagamentiQuery = supabase
          .from('info_pagamenti')
          .select(`
            id, importo_totale, totale_pagato, importo_acconto,
            buste!inner (
              id, readable_id, stato_attuale, data_apertura, tipo_lavorazione, priorita, updated_at, deleted_at,
              clienti (id, nome, cognome, telefono)
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

        return NextResponse.json({ results: paymentResults, total: paymentResults.length })
      }

      // Otherwise, query buste directly
      let query = supabase
        .from('buste')
        .select(`
          id, readable_id, stato_attuale, data_apertura, tipo_lavorazione, priorita, updated_at, note_generali,
          clienti (id, nome, cognome, telefono)
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

      return NextResponse.json({ results: filteredResults, total: filteredResults.length })
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
    return NextResponse.json({ results, total: results.length })
  } catch (error: any) {
    console.error('❌ Advanced search error:', error)
    return NextResponse.json({ error: 'Errore nella ricerca avanzata' }, { status: 500 })
  }
}
