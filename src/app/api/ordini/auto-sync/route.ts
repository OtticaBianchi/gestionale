export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

type OrdineForAutoSync = {
  id: string
  stato: string | null
  data_ordine: string | null
  data_consegna_prevista: string | null
  note: string | null
}

const parseDateSafe = (value: string | null | undefined): Date | null => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const formatTimestamp = (value: Date = new Date()) => {
  const pad = (input: number) => String(input).padStart(2, '0')
  const year = value.getFullYear()
  const month = pad(value.getMonth() + 1)
  const day = pad(value.getDate())
  const hours = pad(value.getHours())
  const minutes = pad(value.getMinutes())
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

const appendNoteLine = (existing: string | null | undefined, line: string) =>
  existing ? `${existing}\n${line}` : line

const buildNoteLine = (message: string) =>
  `${formatTimestamp()} - Sistema: ${message}`

const calcolaDataInArrivo = (dataOrdine: string) => {
  const ordine = new Date(dataOrdine)
  const giorno = ordine.getDay()
  const prossimoGiornoLavorativo = new Date(ordine)

  if (giorno === 5) {
    prossimoGiornoLavorativo.setDate(ordine.getDate() + 3)
  } else if (giorno === 6) {
    prossimoGiornoLavorativo.setDate(ordine.getDate() + 2)
  } else if (giorno === 0) {
    prossimoGiornoLavorativo.setDate(ordine.getDate() + 1)
  } else {
    prossimoGiornoLavorativo.setDate(ordine.getDate() + 1)
  }

  prossimoGiornoLavorativo.setHours(0, 0, 0, 0)
  return prossimoGiornoLavorativo
}

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: ordini, error } = await admin
      .from('ordini_materiali')
      .select('id, stato, data_ordine, data_consegna_prevista, note')
      .is('deleted_at', null)
      .in('stato', ['ordinato', 'in_arrivo'])

    if (error) {
      console.error('ORDINI_AUTO_SYNC_FETCH_ERROR', error)
      return NextResponse.json({ error: 'Errore caricamento ordini per auto-sync' }, { status: 500 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const nowIso = new Date().toISOString()

    let updatedCount = 0
    let movedToInArrivo = 0
    let movedToInRitardo = 0
    const failedOrderIds: string[] = []

    for (const ordine of (ordini || []) as OrdineForAutoSync[]) {
      const statoCorrente = ordine.stato || 'ordinato'
      let nextState = statoCorrente
      let notePayload = ordine.note
      let changed = false
      let toInArrivo = false
      let toInRitardo = false

      if (statoCorrente === 'ordinato' && ordine.data_ordine) {
        const dataInArrivo = calcolaDataInArrivo(ordine.data_ordine)
        if (today >= dataInArrivo) {
          nextState = 'in_arrivo'
          const dataInArrivoFormattata = dataInArrivo.toLocaleDateString('it-IT')
          notePayload = appendNoteLine(
            notePayload,
            buildNoteLine(`Auto-aggiornato: In arrivo da ${dataInArrivoFormattata}.`)
          )
          changed = true
          toInArrivo = true
        }
      }

      if ((nextState === 'ordinato' || nextState === 'in_arrivo') && ordine.data_consegna_prevista) {
        const dataConsegnaPrevista = parseDateSafe(ordine.data_consegna_prevista)
        if (dataConsegnaPrevista) {
          dataConsegnaPrevista.setHours(0, 0, 0, 0)
          if (today > dataConsegnaPrevista) {
            const giorniRitardo = Math.floor(
              (today.getTime() - dataConsegnaPrevista.getTime()) / (1000 * 60 * 60 * 24)
            )
            const dataRitardoFormattata = today.toLocaleDateString('it-IT')
            nextState = 'in_ritardo'
            notePayload = appendNoteLine(
              notePayload,
              buildNoteLine(`Auto-aggiornato: In ritardo da ${dataRitardoFormattata} - ${giorniRitardo} giorni.`)
            )
            changed = true
            toInRitardo = true
          }
        }
      }

      if (!changed) {
        continue
      }

      const updates: Record<string, unknown> = {
        stato: nextState,
        note: notePayload,
        updated_at: nowIso,
        updated_by: user.id
      }

      const { error: updateError } = await admin
        .from('ordini_materiali')
        .update(updates)
        .eq('id', ordine.id)

      if (updateError) {
        console.error('ORDINI_AUTO_SYNC_UPDATE_ERROR', { ordineId: ordine.id, error: updateError })
        failedOrderIds.push(ordine.id)
        continue
      }

      updatedCount += 1
      if (toInRitardo) {
        movedToInRitardo += 1
      } else if (toInArrivo) {
        movedToInArrivo += 1
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount,
      movedToInArrivo,
      movedToInRitardo,
      failedOrderIds
    })
  } catch (error) {
    console.error('ORDINI_AUTO_SYNC_ERROR', error)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}
