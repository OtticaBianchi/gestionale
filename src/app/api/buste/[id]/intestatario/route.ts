export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { logInsert, logUpdate } from '@/lib/audit/auditLog'
import {
  PLACEHOLDER_PHONE,
  normalizePhone,
  isShopPhone,
  isOtticaBianchiName
} from '@/lib/clients/phoneRules'

interface CreateClientePayload {
  nome?: string
  cognome?: string
  genere?: string | null
  telefono?: string | null
  email?: string | null
  note_cliente?: string | null
}

interface ReassignPayload {
  targetClienteId?: string
  createCliente?: CreateClientePayload | null
}

const capitalizeNameProperly = (name: string): string => {
  if (!name) return ''
  const trimmed = name.trim()
  if (!trimmed) return ''

  return trimmed
    .split(' ')
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

const trimOrNull = (value?: string | null): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = profile?.role ?? null
    if (userRole !== 'admin' && userRole !== 'manager') {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
    }

    const { id: bustaId } = await params
    if (!bustaId) {
      return NextResponse.json({ error: 'Busta ID mancante' }, { status: 400 })
    }

    const body: ReassignPayload = await request.json().catch(() => ({}))
    const targetClienteIdFromBody = body.targetClienteId?.trim()
    const createCliente = body.createCliente

    if (targetClienteIdFromBody && createCliente) {
      return NextResponse.json(
        { error: 'Specifica un cliente esistente o un nuovo cliente, non entrambi' },
        { status: 400 }
      )
    }

    if (!targetClienteIdFromBody && !createCliente) {
      return NextResponse.json(
        { error: 'Nessun intestatario specificato per la riassegnazione' },
        { status: 400 }
      )
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: existingBusta, error: bustaError } = await admin
      .from('buste')
      .select('id, cliente_id, updated_at')
      .eq('id', bustaId)
      .single()

    if (bustaError || !existingBusta) {
      console.error('Errore recupero busta per cambio intestatario:', bustaError)
      return NextResponse.json({ error: 'Busta non trovata' }, { status: 404 })
    }

    let targetClienteId: string | null = null
    let targetCliente: any = null

    if (targetClienteIdFromBody) {
      const { data: existingCliente, error: targetError } = await admin
        .from('clienti')
        .select('id, nome, cognome, genere, telefono, email, note_cliente, deleted_at, updated_at')
        .eq('id', targetClienteIdFromBody)
        .maybeSingle()

      if (targetError) {
        console.error('Errore recupero cliente target:', targetError)
        return NextResponse.json({ error: 'Errore recupero cliente target' }, { status: 500 })
      }

      if (!existingCliente || existingCliente.deleted_at) {
        return NextResponse.json({ error: 'Cliente target non trovato' }, { status: 404 })
      }

      targetClienteId = existingCliente.id
      targetCliente = existingCliente
    } else if (createCliente) {
      const nome = capitalizeNameProperly(createCliente.nome || '')
      const cognome = capitalizeNameProperly(createCliente.cognome || '')

      if (!nome || !cognome) {
        return NextResponse.json(
          { error: 'Nome e cognome sono obbligatori per creare il nuovo intestatario' },
          { status: 400 }
        )
      }

      const normalizedPhone = normalizePhone(createCliente.telefono)
      if (!normalizedPhone) {
        return NextResponse.json(
          { error: `Telefono obbligatorio (usa ${PLACEHOLDER_PHONE} se non disponibile)` },
          { status: 400 }
        )
      }

      const usesShopPhone = isShopPhone(normalizedPhone)
      const isOtticaBianchi = isOtticaBianchiName(nome, cognome)

      if (usesShopPhone && !isOtticaBianchi) {
        return NextResponse.json(
          { error: 'Numero negozio consentito solo per Ottica Bianchi' },
          { status: 400 }
        )
      }

      if (usesShopPhone && isOtticaBianchi) {
        return NextResponse.json(
          { error: 'Cliente Ottica Bianchi già presente: selezionalo dalla ricerca' },
          { status: 400 }
        )
      }

      const { data: insertedCliente, error: createError } = await admin
        .from('clienti')
        .insert({
          nome,
          cognome,
          genere: createCliente.genere || null,
          telefono: normalizedPhone,
          email: trimOrNull(createCliente.email),
          note_cliente: trimOrNull(createCliente.note_cliente),
          updated_by: user.id,
          updated_at: new Date().toISOString()
        })
        .select('id, nome, cognome, genere, telefono, email, note_cliente, updated_at')
        .single()

      if (createError || !insertedCliente) {
        console.error('Errore creazione nuovo cliente per cambio intestatario:', createError)
        return NextResponse.json({ error: 'Errore creazione nuovo cliente' }, { status: 500 })
      }

      targetClienteId = insertedCliente.id
      targetCliente = insertedCliente

      const auditInsert = await logInsert(
        'clienti',
        insertedCliente.id,
        user.id,
        {
          nome: insertedCliente.nome,
          cognome: insertedCliente.cognome,
          telefono: insertedCliente.telefono
        },
        'Creazione cliente da cambio intestatario busta',
        { source: 'api/buste/[id]/intestatario', bustaId },
        userRole
      )

      if (!auditInsert.success) {
        console.error('AUDIT_INSERT_CLIENTE_FROM_REASSIGN_FAILED', auditInsert.error)
      }
    }

    if (!targetClienteId) {
      return NextResponse.json({ error: 'Cliente target non valido' }, { status: 400 })
    }

    if (existingBusta.cliente_id === targetClienteId) {
      return NextResponse.json({
        success: true,
        busta: existingBusta,
        cliente: targetCliente,
        noop: true
      })
    }

    const { data: updatedBusta, error: updateError } = await admin
      .from('buste')
      .update({
        cliente_id: targetClienteId,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', bustaId)
      .select('id, cliente_id, updated_at')
      .single()

    if (updateError || !updatedBusta) {
      console.error('Errore update busta per cambio intestatario:', updateError)
      return NextResponse.json({ error: 'Errore aggiornamento intestatario busta' }, { status: 500 })
    }

    const auditUpdate = await logUpdate(
      'buste',
      bustaId,
      user.id,
      {
        cliente_id: existingBusta.cliente_id,
        updated_at: existingBusta.updated_at
      },
      {
        cliente_id: updatedBusta.cliente_id,
        updated_at: updatedBusta.updated_at
      },
      'Cambio intestatario solo questa busta',
      {
        bustaId,
        source: 'api/buste/[id]/intestatario',
        oldClienteId: existingBusta.cliente_id,
        newClienteId: targetClienteId
      },
      userRole
    )

    if (!auditUpdate.success) {
      console.error('AUDIT_UPDATE_BUSTA_REASSIGN_FAILED', auditUpdate.error)
    }

    return NextResponse.json({
      success: true,
      busta: updatedBusta,
      cliente: targetCliente
    })
  } catch (error) {
    console.error('PATCH /api/buste/[id]/intestatario error:', error)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}
