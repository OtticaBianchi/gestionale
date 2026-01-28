export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { logUpdate } from '@/lib/audit/auditLog'
import {
  PLACEHOLDER_PHONE,
  normalizePhone,
  isShopPhone,
  isOtticaBianchiName
} from '@/lib/clients/phoneRules'

interface ClientePayload {
  id?: string
  nome?: string
  cognome?: string
  genere?: string | null
  telefono?: string | null
  email?: string | null
  note_cliente?: string | null
}

interface BustaPayload {
  tipo_lavorazione?: string | null
  priorita?: string
  note_generali?: string | null
  is_suspended?: boolean
  data_sospensione?: string | null
  data_riesame_sospensione?: string | null
  archived_mode?: string | null
  sospesa_followup_done_at?: string | null
  sospesa_followup_reason?: string | null
  sospesa_followup_note?: string | null
  cliente?: ClientePayload
}

// ===== UTILITY FUNCTION FOR NAME CAPITALIZATION =====
const capitalizeNameProperly = (name: string): string => {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  // Split by spaces, filter empty strings, and capitalize each word
  return trimmed
    .split(' ')
    .filter(word => word.length > 0) // Remove empty strings from multiple spaces
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = profile?.role ?? null

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Busta ID mancante' }, { status: 400 })
    }

    const body: BustaPayload = await request.json().catch(() => ({}))
    const clienteBody = body.cliente ?? null

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: existingBusta, error: bustaFetchError } = await admin
      .from('buste')
      .select('id, cliente_id, tipo_lavorazione, priorita, note_generali, is_suspended, data_sospensione, data_riesame_sospensione, archived_mode, sospesa_followup_done_at, sospesa_followup_reason, sospesa_followup_note')
      .eq('id', id)
      .single()

    if (bustaFetchError || !existingBusta) {
      console.error('Errore recupero busta:', bustaFetchError)
      return NextResponse.json({ error: 'Busta non trovata' }, { status: 404 })
    }

    const clienteId = existingBusta.cliente_id ?? clienteBody?.id ?? null

    const fieldsToUpdate: Record<string, any> = {}
    if (body.tipo_lavorazione !== undefined) {
      fieldsToUpdate.tipo_lavorazione = body.tipo_lavorazione || null
    }
    if (body.priorita !== undefined) {
      fieldsToUpdate.priorita = body.priorita
    }
    if (body.note_generali !== undefined) {
      fieldsToUpdate.note_generali = body.note_generali?.trim() || null
    }
    if (body.is_suspended !== undefined) {
      fieldsToUpdate.is_suspended = body.is_suspended
    }
    if (body.data_sospensione !== undefined) {
      fieldsToUpdate.data_sospensione = body.data_sospensione || null
    }
    if (body.data_riesame_sospensione !== undefined) {
      fieldsToUpdate.data_riesame_sospensione = body.data_riesame_sospensione || null
    }
    if (body.archived_mode !== undefined) {
      fieldsToUpdate.archived_mode = body.archived_mode || null
    }
    if (body.sospesa_followup_done_at !== undefined) {
      fieldsToUpdate.sospesa_followup_done_at = body.sospesa_followup_done_at || null
    }
    if (body.sospesa_followup_reason !== undefined) {
      fieldsToUpdate.sospesa_followup_reason = body.sospesa_followup_reason || null
    }
    if (body.sospesa_followup_note !== undefined) {
      fieldsToUpdate.sospesa_followup_note = body.sospesa_followup_note || null
    }
    if (body.is_suspended === false) {
      fieldsToUpdate.data_sospensione = null
      fieldsToUpdate.data_riesame_sospensione = null
    }
    if (!existingBusta.cliente_id && clienteId) {
      fieldsToUpdate.cliente_id = clienteId
    }

    let updatedBusta = existingBusta
    if (Object.keys(fieldsToUpdate).length > 0) {
      const { data, error: updateBustaError } = await admin
        .from('buste')
        .update({
          ...fieldsToUpdate,
          updated_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select('id, cliente_id, tipo_lavorazione, priorita, note_generali, is_suspended, data_sospensione, data_riesame_sospensione, archived_mode, sospesa_followup_done_at, sospesa_followup_reason, sospesa_followup_note, updated_at')
        .single()

      if (updateBustaError || !data) {
        console.error('Errore aggiornamento busta:', updateBustaError)
        return NextResponse.json({ error: 'Errore aggiornamento busta' }, { status: 500 })
      }

      updatedBusta = data

      const audit = await logUpdate(
        'buste',
        id,
        user.id,
        existingBusta,
        updatedBusta,
        'Aggiornamento anagrafica busta',
        { bustaId: id },
        userRole
      )

      if (!audit.success) {
        console.error('AUDIT_UPDATE_BUSTA_FAILED', audit.error)
      }
    }

    let updatedCliente = null
    if (clienteBody && clienteId) {
      const clienteUpdates: Record<string, any> = {}
      const normalizedPhone = normalizePhone(clienteBody.telefono)
      if (clienteBody.nome !== undefined) clienteUpdates.nome = capitalizeNameProperly(clienteBody.nome)
      if (clienteBody.cognome !== undefined) clienteUpdates.cognome = capitalizeNameProperly(clienteBody.cognome)
      if (clienteBody.genere !== undefined) clienteUpdates.genere = clienteBody.genere
      if (clienteBody.telefono !== undefined) {
        if (!normalizedPhone) {
          return NextResponse.json({ error: `Telefono obbligatorio (usa ${PLACEHOLDER_PHONE} se non disponibile)` }, { status: 400 })
        }
        clienteUpdates.telefono = normalizedPhone
      }
      if (clienteBody.email !== undefined) clienteUpdates.email = clienteBody.email?.trim() || null
      if (clienteBody.note_cliente !== undefined) clienteUpdates.note_cliente = clienteBody.note_cliente?.trim() || null

      if (Object.keys(clienteUpdates).length > 0) {
        const { data: existingCliente, error: fetchClienteError } = await admin
          .from('clienti')
          .select('id, nome, cognome, genere, telefono, email, note_cliente')
          .eq('id', clienteId)
          .single()

        if (fetchClienteError || !existingCliente) {
          console.error('Errore recupero cliente:', fetchClienteError)
          return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 })
        }

        const nextNome = clienteUpdates.nome ?? existingCliente.nome
        const nextCognome = clienteUpdates.cognome ?? existingCliente.cognome
        const nextTelefono = clienteUpdates.telefono ?? existingCliente.telefono
        const usesShopPhone = isShopPhone(nextTelefono)
        const isOtticaBianchi = isOtticaBianchiName(nextNome, nextCognome)

        if (usesShopPhone && !isOtticaBianchi) {
          return NextResponse.json({ error: 'Numero negozio consentito solo per Ottica Bianchi' }, { status: 400 })
        }

        const { data: clienteData, error: updateClienteError } = await admin
          .from('clienti')
          .update({
            ...clienteUpdates,
            updated_by: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingCliente.id)
          .select('id, nome, cognome, genere, telefono, email, note_cliente, updated_at')
          .single()

        if (updateClienteError || !clienteData) {
          console.error('Errore aggiornamento cliente:', updateClienteError)
          return NextResponse.json({ error: 'Errore aggiornamento cliente' }, { status: 500 })
        }

        updatedCliente = clienteData

        const audit = await logUpdate(
          'clienti',
          clienteData.id,
          user.id,
          existingCliente,
          clienteData,
          'Aggiornamento dati cliente da anagrafica busta',
          { bustaId: id },
          userRole
        )

        if (!audit.success) {
          console.error('AUDIT_UPDATE_CLIENTE_FAILED', audit.error)
        }
      }
    } else if (clienteBody && !clienteId) {
      return NextResponse.json({ error: 'Cliente non collegato alla busta' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      busta: updatedBusta,
      cliente: updatedCliente
    })

  } catch (error) {
    console.error('PATCH /api/buste/[id]/anagrafica error:', error)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}
