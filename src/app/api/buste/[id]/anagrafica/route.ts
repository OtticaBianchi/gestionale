export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { logUpdate } from '@/lib/audit/auditLog'

interface ClientePayload {
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
  cliente?: ClientePayload
}

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

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: existingBusta, error: bustaFetchError } = await admin
      .from('buste')
      .select('id, cliente_id, tipo_lavorazione, priorita, note_generali, is_suspended')
      .eq('id', id)
      .single()

    if (bustaFetchError || !existingBusta) {
      console.error('Errore recupero busta:', bustaFetchError)
      return NextResponse.json({ error: 'Busta non trovata' }, { status: 404 })
    }

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
        .select('id, cliente_id, tipo_lavorazione, priorita, note_generali, is_suspended, updated_at')
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
    if (body.cliente && existingBusta.cliente_id) {
      const clienteUpdates: Record<string, any> = {}
      const clienteBody = body.cliente
      if (clienteBody.nome !== undefined) clienteUpdates.nome = clienteBody.nome.trim()
      if (clienteBody.cognome !== undefined) clienteUpdates.cognome = clienteBody.cognome.trim()
      if (clienteBody.genere !== undefined) clienteUpdates.genere = clienteBody.genere
      if (clienteBody.telefono !== undefined) clienteUpdates.telefono = clienteBody.telefono?.trim() || null
      if (clienteBody.email !== undefined) clienteUpdates.email = clienteBody.email?.trim() || null
      if (clienteBody.note_cliente !== undefined) clienteUpdates.note_cliente = clienteBody.note_cliente?.trim() || null

      if (Object.keys(clienteUpdates).length > 0) {
        const { data: existingCliente, error: fetchClienteError } = await admin
          .from('clienti')
          .select('id, nome, cognome, genere, telefono, email, note_cliente')
          .eq('id', existingBusta.cliente_id)
          .single()

        if (fetchClienteError || !existingCliente) {
          console.error('Errore recupero cliente:', fetchClienteError)
          return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 })
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
