export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolveSaldoUnicoMethod } from '@/lib/payments/saldoMethod'
import { fetchSchedeFocusMancanti, type SchedaFocusMancanteRow } from '@/lib/scheda-focus/mancanti'

export type { SchedaFocusMancanteRow }

export interface BustaReportRow {
  id: string
  readable_id: string
  data_apertura: string
  tipo_lavorazione: string | null
  cliente_nome: string
  creato_da_nome: string
  note: NoteEntry[]
}

export interface BustaSospesaRow {
  id: string
  readable_id: string
  tipo_lavorazione: string | null
  cliente_nome: string
  telefono: string | null
  stato_attuale: string
  data_sospensione: string | null
  data_riesame_sospensione: string | null
  note: NoteEntry[]
}

export interface BustaPagheroRow {
  id: string
  readable_id: string
  tipo_lavorazione: string | null
  cliente_nome: string
  telefono: string | null
  data_consegna: string | null
  importo_da_incassare: number | null
}

export interface NoteEntry {
  label: string
  text: string
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Data non valida (formato: YYYY-MM-DD)' }, { status: 400 })
    }

    const dateFrom = `${date}T00:00:00.000Z`
    const dateTo   = `${date}T23:59:59.999Z`

    const { data: buste, error } = await supabase
      .from('buste')
      .select(`
        id,
        readable_id,
        data_apertura,
        tipo_lavorazione,
        note_generali,
        note_spedizione,
        clienti (nome, cognome),
        creato_da_profile:profiles!buste_creato_da_fkey (full_name),
        ordini_materiali (note, descrizione_prodotto),
        lavorazioni (note, tentativo)
      `)
      .gte('data_apertura', dateFrom)
      .lte('data_apertura', dateTo)
      .is('deleted_at', null)
      .neq('stato_attuale', 'consegnato_pagato')
      .order('data_apertura', { ascending: true })

    if (error) {
      console.error('Report buste giornaliero error:', error)
      return NextResponse.json({ error: 'Errore nel caricamento dei dati' }, { status: 500 })
    }

    // Snapshot dello stato attuale (non dipende dalla data selezionata)
    const { data: sospeseRaw, error: sospeseError } = await supabase
      .from('buste')
      .select(`
        id,
        readable_id,
        tipo_lavorazione,
        stato_attuale,
        data_sospensione,
        data_riesame_sospensione,
        note_generali,
        clienti (nome, cognome, telefono)
      `)
      .eq('is_suspended', true)
      .is('deleted_at', null)
      .neq('stato_attuale', 'consegnato_pagato')
      .order('data_sospensione', { ascending: true })

    if (sospeseError) {
      console.error('Report buste sospese error:', sospeseError)
      return NextResponse.json({ error: 'Errore nel caricamento delle buste sospese' }, { status: 500 })
    }

    const { data: pagheroRaw, error: pagheroError } = await supabase
      .from('buste')
      .select(`
        id,
        readable_id,
        tipo_lavorazione,
        data_completamento_consegna,
        updated_at,
        clienti (nome, cognome, telefono),
        info_pagamenti!inner (
          is_saldato,
          modalita_saldo,
          note_pagamento,
          prezzo_finale,
          importo_acconto
        ),
        payment_plan:payment_plans (
          is_completed,
          total_amount,
          acconto
        )
      `)
      .eq('stato_attuale', 'consegnato_pagato')
      .is('deleted_at', null)
      .ilike('info_pagamenti.note_pagamento', '%SALDO_UNICO_METHOD=paghero%')
      .order('updated_at', { ascending: true })

    if (pagheroError) {
      console.error('Report buste pagherò error:', pagheroError)
      return NextResponse.json({ error: 'Errore nel caricamento dei pagherò' }, { status: 500 })
    }

    const { rows: schedaFocus, error: schedaFocusError } = await fetchSchedeFocusMancanti(supabase)
    if (schedaFocusError) {
      console.error('Report scheda focus error:', schedaFocusError)
      return NextResponse.json({ error: 'Errore nel caricamento delle Schede Focus' }, { status: 500 })
    }

    const one = <T,>(v: T | T[] | null | undefined): T | null =>
      Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

    const sospese: BustaSospesaRow[] = (sospeseRaw || []).map((b: any) => {
      const cliente = one<any>(b.clienti)
      const note: NoteEntry[] = b.note_generali?.trim()
        ? [{ label: 'Generali', text: b.note_generali.trim() }]
        : []
      return {
        id: b.id,
        readable_id: b.readable_id,
        tipo_lavorazione: b.tipo_lavorazione || null,
        cliente_nome: cliente ? `${cliente.cognome || ''} ${cliente.nome || ''}`.trim() : '—',
        telefono: cliente?.telefono || null,
        stato_attuale: b.stato_attuale,
        data_sospensione: b.data_sospensione || null,
        data_riesame_sospensione: b.data_riesame_sospensione || null,
        note,
      }
    })

    // Pagherò ancora da incassare (stessa regola del badge: il piano, se c'è, ha la precedenza su is_saldato)
    const pagheroRows: BustaPagheroRow[] = (pagheroRaw || [])
      .map((b: any) => {
        const info = one<any>(b.info_pagamenti)
        const plan = one<any>(b.payment_plan)
        const method = resolveSaldoUnicoMethod({
          modalitaSaldo: info?.modalita_saldo,
          notePagamento: info?.note_pagamento,
        })
        const completed = plan?.is_completed ?? (info?.is_saldato === true)
        if (method !== 'paghero' || completed) return null

        const cliente = one<any>(b.clienti)
        const totale = plan?.total_amount ?? info?.prezzo_finale ?? null
        const acconto = plan?.acconto ?? info?.importo_acconto ?? 0
        const residuo = totale != null ? Math.max(totale - Math.max(acconto, 0), 0) : null

        return {
          id: b.id,
          readable_id: b.readable_id,
          tipo_lavorazione: b.tipo_lavorazione || null,
          cliente_nome: cliente ? `${cliente.cognome || ''} ${cliente.nome || ''}`.trim() : '—',
          telefono: cliente?.telefono || null,
          data_consegna: b.data_completamento_consegna || b.updated_at || null,
          importo_da_incassare: residuo,
        } as BustaPagheroRow
      })
      .filter((r): r is BustaPagheroRow => r !== null)

    const rows: BustaReportRow[] = (buste || []).map((b: any) => {
      const cliente = b.clienti
      const cliente_nome = cliente
        ? `${cliente.cognome || ''} ${cliente.nome || ''}`.trim()
        : '—'

      const creato_da_nome =
        (Array.isArray(b.creato_da_profile)
          ? b.creato_da_profile[0]?.full_name
          : b.creato_da_profile?.full_name) || '—'

      const note: NoteEntry[] = []

      if (b.note_generali?.trim()) {
        note.push({ label: 'Generali', text: b.note_generali.trim() })
      }
      if (b.note_spedizione?.trim()) {
        note.push({ label: 'Spedizione', text: b.note_spedizione.trim() })
      }
      ;(b.ordini_materiali || []).forEach((o: any) => {
        if (o.note?.trim()) {
          const label = o.descrizione_prodotto
            ? `Ordine – ${o.descrizione_prodotto}`
            : 'Ordine materiali'
          note.push({ label, text: o.note.trim() })
        }
      })
      ;(b.lavorazioni || []).forEach((l: any) => {
        if (l.note?.trim()) {
          note.push({ label: `Lavorazione #${l.tentativo}`, text: l.note.trim() })
        }
      })

      return {
        id: b.id,
        readable_id: b.readable_id,
        data_apertura: b.data_apertura,
        tipo_lavorazione: b.tipo_lavorazione || null,
        cliente_nome,
        creato_da_nome,
        note,
      }
    })

    return NextResponse.json({ rows, sospese, paghero: pagheroRows, schedaFocus, date, total: rows.length })
  } catch (err: any) {
    console.error('Report buste giornaliero unexpected error:', err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
