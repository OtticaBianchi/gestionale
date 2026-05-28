export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AlertBusta } from '@/types/briefing'

export async function GET() {
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

    const seenBustaIds = new Set<string>()
    const alerts: AlertBusta[] = []

    // ── SEZIONE 1: urgenze ──────────────────────────────────────────────────
    // Buste urgente/critica, non archiviate, non sospese,
    // ferme da più di 24h, escluse quelle pronto_ritiro con telefonata già fatta
    const { data: urgenze, error: urgenzeError } = await supabase
      .from('buste')
      .select(`
        id,
        readable_id,
        tipo_lavorazione,
        stato_attuale,
        priorita,
        note_generali,
        updated_at,
        clienti (nome, cognome, telefono)
      `)
      .in('priorita', ['urgente', 'critica'])
      .neq('stato_attuale', 'consegnato_pagato')
      .eq('is_suspended', false)
      .is('deleted_at', null)
      .lt('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .or('stato_attuale.neq.pronto_ritiro,telefonata_completata.eq.false')

    if (urgenzeError) throw urgenzeError

    for (const b of urgenze ?? []) {
      if (seenBustaIds.has(b.id)) continue
      seenBustaIds.add(b.id)
      const ore = b.updated_at ? Math.round((Date.now() - new Date(b.updated_at).getTime()) / 3_600_000) : 0
      const cliente = Array.isArray(b.clienti) ? b.clienti[0] : b.clienti
      alerts.push({
        busta_id: b.id,
        readable_id: b.readable_id ?? '',
        tipo_lavorazione: b.tipo_lavorazione ?? '',
        stato_attuale: b.stato_attuale ?? '',
        priorita: b.priorita ?? '',
        note_generali: b.note_generali,
        ore_in_stato: ore,
        sezione: 'urgenze',
        motivo: `Busta ${b.priorita} ferma da ${ore} ore in ${b.stato_attuale}`,
        cliente_nome: cliente?.nome ?? '',
        cliente_cognome: cliente?.cognome ?? '',
        cliente_telefono: cliente?.telefono ?? null,
      })
    }

    // ── SEZIONE 2: flusso_inceppato ─────────────────────────────────────────
    // Buste normali ferme oltre le soglie per stato, esclude già in sezione 1
    const now = new Date()
    const h48 = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const d7  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: inceppate, error: inceppateError } = await supabase
      .from('buste')
      .select(`
        id,
        readable_id,
        tipo_lavorazione,
        stato_attuale,
        priorita,
        note_generali,
        updated_at,
        clienti (nome, cognome, telefono)
      `)
      .not('priorita', 'in', '("urgente","critica")')
      .neq('stato_attuale', 'consegnato_pagato')
      .neq('stato_attuale', 'materiali_ordinati')
      .eq('is_suspended', false)
      .is('deleted_at', null)
      .or(
        `and(stato_attuale.eq.nuove,updated_at.lt.${h48}),` +
        `and(stato_attuale.eq.materiali_arrivati,updated_at.lt.${h48}),` +
        `and(stato_attuale.eq.in_lavorazione,updated_at.lt.${h24}),` +
        `and(stato_attuale.eq.pronto_ritiro,updated_at.lt.${d7})`
      )

    if (inceppateError) throw inceppateError

    for (const b of inceppate ?? []) {
      if (seenBustaIds.has(b.id)) continue
      seenBustaIds.add(b.id)
      const ore = b.updated_at ? Math.round((Date.now() - new Date(b.updated_at).getTime()) / 3_600_000) : 0
      const giorni = Math.round(ore / 24)
      const cliente = Array.isArray(b.clienti) ? b.clienti[0] : b.clienti
      const durataLabel = ore >= 48 ? `${giorni} giorni` : `${ore} ore`
      alerts.push({
        busta_id: b.id,
        readable_id: b.readable_id ?? '',
        tipo_lavorazione: b.tipo_lavorazione ?? '',
        stato_attuale: b.stato_attuale ?? '',
        priorita: b.priorita ?? '',
        note_generali: b.note_generali,
        ore_in_stato: ore,
        sezione: 'flusso_inceppato',
        motivo: `Ferma in '${b.stato_attuale}' da ${durataLabel}`,
        cliente_nome: cliente?.nome ?? '',
        cliente_cognome: cliente?.cognome ?? '',
        cliente_telefono: cliente?.telefono ?? null,
      })
    }

    // ── SEZIONE 3: materiali_ritardo ────────────────────────────────────────
    const { data: ritardo, error: ritardoError } = await supabase
      .from('buste')
      .select(`
        id,
        readable_id,
        tipo_lavorazione,
        stato_attuale,
        priorita,
        note_generali,
        updated_at,
        clienti (nome, cognome, telefono),
        ordini_materiali!inner (categoria_fornitore, stato)
      `)
      .neq('stato_attuale', 'consegnato_pagato')
      .eq('is_suspended', false)
      .is('deleted_at', null)
      .eq('ordini_materiali.stato', 'in_ritardo')

    if (ritardoError) throw ritardoError

    for (const b of ritardo ?? []) {
      if (seenBustaIds.has(b.id)) continue
      seenBustaIds.add(b.id)
      const ore = b.updated_at ? Math.round((Date.now() - new Date(b.updated_at).getTime()) / 3_600_000) : 0
      const cliente = Array.isArray(b.clienti) ? b.clienti[0] : b.clienti
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ordini: any[] = Array.isArray(b.ordini_materiali) ? b.ordini_materiali : [b.ordini_materiali]
      const categorieRitardo = ordini
        .filter((o) => o.stato === 'in_ritardo')
        .map((o) => o.categoria_fornitore)
        .filter(Boolean)
        .join(', ')
      alerts.push({
        busta_id: b.id,
        readable_id: b.readable_id ?? '',
        tipo_lavorazione: b.tipo_lavorazione ?? '',
        stato_attuale: b.stato_attuale ?? '',
        priorita: b.priorita ?? '',
        note_generali: b.note_generali,
        ore_in_stato: ore,
        sezione: 'materiali_ritardo',
        motivo: categorieRitardo
          ? `Materiale in ritardo (ordine: ${categorieRitardo})`
          : 'Materiale in ritardo',
        cliente_nome: cliente?.nome ?? '',
        cliente_cognome: cliente?.cognome ?? '',
        cliente_telefono: cliente?.telefono ?? null,
      })
    }

    // Ordina per sezione (urgenze > flusso_inceppato > materiali_ritardo),
    // poi per ore_in_stato DESC all'interno di ogni sezione
    const sezioneOrder: Record<string, number> = {
      urgenze: 0,
      flusso_inceppato: 1,
      materiali_ritardo: 2,
    }
    alerts.sort((a, b) => {
      const diff = sezioneOrder[a.sezione] - sezioneOrder[b.sezione]
      if (diff !== 0) return diff
      return b.ore_in_stato - a.ore_in_stato
    })

    return NextResponse.json({ alerts })
  } catch (error) {
    console.error('[briefing/alerts] GET error:', error)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
