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

async function searchClients(ctx: SearchContext, forceIncludeEmpty = false): Promise<SearchResult[]> {
  const { supabase, searchTerm, includeArchived, isBustaArchived } = ctx
  const { data: clienti, error } = await supabase
    .from('clienti')
    .select(`
      id, nome, cognome, telefono, email,
      buste (
        id, readable_id, stato_attuale, data_apertura, updated_at,
        tipo_lavorazione, priorita, note_generali
      )
    `)
    .or(`cognome.ilike.%${searchTerm}%,nome.ilike.%${searchTerm}%`)
    .order('cognome')
    .limit(20)

  if (error || !clienti) return []

  return clienti.reduce<SearchResult[]>((acc, cliente) => {
    const buste = cliente.buste?.filter((busta: any) => {
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
      buste (
        id, readable_id, stato_attuale, updated_at, data_apertura,
        clienti (id, nome, cognome)
      )
    `)
    .not(campoFornitore, 'is', null)
    .limit(30)

  if (error || !data) return []

  return data.reduce<SearchResult[]>((acc, ordine) => {
    if (!ordine.buste) return acc
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
      buste (
        id, readable_id, stato_attuale, updated_at, data_apertura,
        clienti (id, nome, cognome)
      )
    `)
    .or(`tipo.ilike.%${searchTerm}%,codice_prodotto.ilike.%${searchTerm}%,note.ilike.%${searchTerm}%`)
    .limit(30)

  const materialResults = (error || !materiali)
    ? []
    : materiali.reduce<SearchResult[]>((acc, materiale) => {
        if (!materiale.buste) return acc
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
        buste (
          id, readable_id, stato_attuale, updated_at, data_apertura,
          clienti (id, nome, cognome)
        )`
      )
      .in(key, supplierIds)
      .limit(50)

    if (!ordini) return [] as SearchResult[]

    const suppliersById = new Map(data.map((supplier) => [supplier.id, supplier]))

    return ordini.reduce<SearchResult[]>((acc, ordine) => {
      const supplierId = (ordine as any)[key]
      if (!supplierId) return acc

      const supplier = suppliersById.get(supplierId)
      if (!supplier || !ordine.buste) return acc

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

    // Check if we have filters (allow search with just filters, no text query)
    const hasFilters = bustaId || priorita || tipoLavorazione || fornitore || categoria || dateFrom || dateTo
    const hasTextQuery = query && query.trim().length >= 2

    if (!hasTextQuery && !hasFilters) {
      return NextResponse.json({ results: [] })
    }

    const searchTerm = query?.trim() || ''
    console.log('🔍 Advanced search:', { searchTerm, type, includeArchived, bustaId, priorita, tipoLavorazione, fornitore, categoria, dateFrom, dateTo })

    const now = new Date()

    // ===== BUSTA ID SEARCH (Direct lookup) =====
    if (bustaId) {
      const { data: buste } = await supabase
        .from('buste')
        .select(`
          id, readable_id, stato_attuale, data_apertura, tipo_lavorazione, priorita, updated_at,
          clienti (id, nome, cognome, telefono)
        `)
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

    // ===== FILTER-BASED SEARCH (for categoria/fornitore, we need to query ordini_materiali) =====
    if (priorita || tipoLavorazione || categoria || fornitore || (dateFrom && dateTo)) {
      // If searching by categoria or fornitore, query ordini_materiali first
      if (categoria || fornitore) {
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
              id, readable_id, stato_attuale, data_apertura, tipo_lavorazione, priorita, updated_at,
              clienti (id, nome, cognome, telefono)
            )
          `)

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
          if (ordine.buste && !busteMap.has(ordine.buste.id)) {
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
          matchField: [priorita && 'priorità', tipoLavorazione && 'tipo lavorazione', categoria && 'categoria', fornitore && 'fornitore', (dateFrom && dateTo) && 'periodo'].filter(Boolean).join(', ')
        }))

        return NextResponse.json({ results: filteredResults, total: filteredResults.length })
      }

      // Otherwise, query buste directly
      let query = supabase
        .from('buste')
        .select(`
          id, readable_id, stato_attuale, data_apertura, tipo_lavorazione, priorita, updated_at, note_generali,
          clienti (id, nome, cognome, telefono)
        `)

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
      tasks.push(searchClients(ctx, false), searchProducts(ctx), searchSuppliers(ctx))
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
