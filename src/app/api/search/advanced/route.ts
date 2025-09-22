export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

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

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ results: [] })
    }

    const searchTerm = query.trim()
    console.log('🔍 Advanced search:', { searchTerm, type, includeArchived })

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const ctx: SearchContext = {
      supabase,
      searchTerm,
      includeArchived,
      isBustaArchived: (busta) => {
        if (busta.stato_attuale !== 'consegnato_pagato') return false
        const updatedAt = new Date(busta.updated_at)
        return updatedAt < sevenDaysAgo
      },
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
    return NextResponse.json({ results })
  } catch (error: any) {
    console.error('❌ Advanced search error:', error)
    return NextResponse.json({ error: 'Errore nella ricerca avanzata' }, { status: 500 })
  }
}
