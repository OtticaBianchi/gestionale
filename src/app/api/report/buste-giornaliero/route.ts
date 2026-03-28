export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export interface BustaReportRow {
  id: string
  readable_id: string
  data_apertura: string
  tipo_lavorazione: string | null
  cliente_nome: string
  creato_da_nome: string
  note: NoteEntry[]
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

    return NextResponse.json({ rows, date, total: rows.length })
  } catch (err: any) {
    console.error('Report buste giornaliero unexpected error:', err)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
