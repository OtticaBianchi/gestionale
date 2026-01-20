export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { logDelete, logUpdate } from '@/lib/audit/auditLog'

const FORBIDDEN_FIELDS = [
  'busta_id',
  'fornitore_id',
  'fornitore_lenti_id',
  'fornitore_lac_id',
  'fornitore_montature_id',
  'fornitore_lab_esterno_id',
  'fornitore_sport_id',
  'fornitore_accessori_id',
  'tipo_lenti_id',
  'tipo_ordine_id',
  'descrizione_prodotto',
  'giorni_consegna_medi',
  'giorni_ritardo',
  'creato_da',
] as const

const BASE_FIELD_MAPPERS: Record<string, (value: unknown) => unknown> = {
  stato: (value) => value,
  da_ordinare: (value) => Boolean(value),
  data_consegna_prevista: (value) => value,
  data_consegna_effettiva: (value) => value,
  data_ordine: (value) => value,
  note: (value) => value,
  stato_disponibilita: (value) => value,
  promemoria_disponibilita: (value) => value,
  needs_action: (value) => Boolean(value),
  needs_action_type: (value) => value,
  needs_action_done: (value) => Boolean(value),
  needs_action_due_date: (value) => value,
  cancel_reason: (value) => value,
}

const ADMIN_FIELD_MAPPERS: Record<string, (value: unknown) => unknown> = {
  categoria_fornitore: (value) => (typeof value === 'string' ? value.trim() || null : value ?? null),
  fornitore_lenti_id: (value) => value || null,
  fornitore_lac_id: (value) => value || null,
  fornitore_montature_id: (value) => value || null,
  fornitore_lab_esterno_id: (value) => value || null,
  fornitore_sport_id: (value) => value || null,
  fornitore_accessori_id: (value) => value || null,
  tipo_lenti_id: (value) => value || null,
  tipo_ordine_id: (value) => (value === null || value === '' ? null : Number(value)),
  descrizione_prodotto: (value) => (typeof value === 'string' ? value.trim() : value),
  giorni_consegna_medi: (value) => (value === null || value === '' ? null : Number(value)),
}

type AllowedPayload = Record<string, unknown>

type AuthCheckResult = { response: NextResponse } | { userId: string; role: string }

async function ensureManagerOrAdmin(): Promise<AuthCheckResult> {
  const server = await createServerSupabaseClient()
  const {
    data: { user },
  } = await server.auth.getUser()

  if (!user) {
    return { response: NextResponse.json({ error: 'Non autorizzato' }, { status: 401 }) }
  }

  const { data: profile } = await server
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role
  if (role !== 'admin' && role !== 'manager') {
    return { response: NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 }) }
  }

  return { userId: user.id, role }
}

function parseJsonBody(request: NextRequest) {
  return request
    .json()
    .catch(() => ({ parseError: NextResponse.json({ error: 'JSON non valido' }, { status: 400 }) }))
}

function buildAllowedFields(
  body: Record<string, unknown>,
  fieldMappers: Record<string, (value: unknown) => unknown>,
  forbiddenFields: readonly string[]
): {
  allowed: AllowedPayload
  forbiddenKey?: string
} {
  const allowedEntries = Object.entries(fieldMappers)
    .filter(([key]) => Object.prototype.hasOwnProperty.call(body, key))
    .map(([key, mapper]) => [key, mapper(body[key])])

  const allowed = Object.fromEntries(allowedEntries)

  const forbiddenKey = Object.keys(body).find(
    (key) => !fieldMappers[key] && forbiddenFields.includes(key)
  )

  return { allowed, forbiddenKey }
}

// Manager/Admin endpoint to update safe operational fields on ordini_materiali
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'ID mancante' }, { status: 400 })

    const authResult = await ensureManagerOrAdmin()
    if ('response' in authResult) {
      return authResult.response
    }
    const { userId, role } = authResult

    const payload = await parseJsonBody(request)
    if ('parseError' in payload) {
      return payload.parseError
    }

    const body = payload as Record<string, unknown>
    const fieldMappers = role === 'admin'
      ? { ...BASE_FIELD_MAPPERS, ...ADMIN_FIELD_MAPPERS }
      : BASE_FIELD_MAPPERS
    const forbiddenFields = role === 'admin'
      ? FORBIDDEN_FIELDS.filter((field) => !(field in ADMIN_FIELD_MAPPERS))
      : FORBIDDEN_FIELDS
    const { allowed, forbiddenKey } = buildAllowedFields(body, fieldMappers, forbiddenFields)

    if (forbiddenKey) {
      return NextResponse.json({ error: `Campo non modificabile: ${forbiddenKey}` }, { status: 400 })
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'Nessun campo aggiornabile fornito' }, { status: 400 })
    }

    if (Object.prototype.hasOwnProperty.call(allowed, 'descrizione_prodotto')) {
      const value = typeof allowed.descrizione_prodotto === 'string'
        ? allowed.descrizione_prodotto.trim()
        : ''
      if (!value) {
        return NextResponse.json({ error: 'La descrizione del prodotto è obbligatoria' }, { status: 400 })
      }
      allowed.descrizione_prodotto = value
    }

    // Write with service role after server-side check
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const selectColumns = ['id', ...Object.keys(allowed)].join(', ')
    const { data: existing, error: fetchError } = await admin
      .from('ordini_materiali')
      .select(selectColumns)
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      console.error('Ordine fetch error prima di update:', fetchError)
      return NextResponse.json({ error: 'Ordine non trovato' }, { status: 404 })
    }

    const { data, error } = await admin
      .from('ordini_materiali')
      .update({
        ...allowed,
        updated_at: new Date().toISOString(),
        updated_by: userId
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Ordine update error:', error)
      return NextResponse.json({ error: 'Errore aggiornamento ordine' }, { status: 500 })
    }

    const oldValues: Record<string, any> = {}
    Object.keys(allowed).forEach((field) => {
      oldValues[field] = (existing as Record<string, any>)[field]
    })

    const audit = await logUpdate(
      'ordini_materiali',
      id,
      userId,
      oldValues,
      allowed,
      'Aggiornamento campi consentiti ordine',
      { source: 'api/ordini/[id] PATCH', fields: Object.keys(allowed) },
      role
    )

    if (!audit.success) {
      console.error('AUDIT_UPDATE_ORDINE_FAILED', audit.error)
    }

    return NextResponse.json({ success: true, ordine: data })

  } catch (e) {
    console.error('Ordine PATCH error:', e)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'ID mancante' }, { status: 400 })

    const authResult = await ensureManagerOrAdmin()
    if ('response' in authResult) {
      return authResult.response
    }
    const { userId, role } = authResult

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: existing, error: fetchError } = await admin
      .from('ordini_materiali')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      console.error('Ordine fetch error prima di delete:', fetchError)
      return NextResponse.json({ error: 'Ordine non trovato' }, { status: 404 })
    }

    const { error: deleteError } = await admin
      .from('ordini_materiali')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Ordine delete error:', deleteError)
      return NextResponse.json({ error: 'Errore eliminazione ordine' }, { status: 500 })
    }

    const audit = await logDelete(
      'ordini_materiali',
      id,
      userId,
      existing,
      'Eliminazione ordine',
      { bustaId: existing.busta_id },
      role
    )

    if (!audit.success) {
      console.error('AUDIT_DELETE_ORDINE_FAILED', audit.error)
    }

    return NextResponse.json({ success: true })

  } catch (e) {
    console.error('Ordine DELETE error:', e)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}
