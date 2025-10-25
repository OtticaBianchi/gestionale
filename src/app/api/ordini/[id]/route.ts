export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const FORBIDDEN_FIELDS = [
  'busta_id',
  'fornitore_id',
  'fornitore_lenti_id',
  'fornitore_lac_id',
  'fornitore_montature_id',
  'fornitore_lab_esterno_id',
  'fornitore_sport_id',
  'tipo_lenti_id',
  'tipo_ordine_id',
  'descrizione_prodotto',
  'giorni_consegna_medi',
  'giorni_ritardo',
  'creato_da',
] as const

const FIELD_MAPPERS: Record<string, (value: unknown) => unknown> = {
  stato: (value) => value,
  da_ordinare: (value) => Boolean(value),
  data_consegna_prevista: (value) => value,
  data_consegna_effettiva: (value) => value,
  data_ordine: (value) => value,
  note: (value) => value,
  stato_disponibilita: (value) => value,
  promemoria_disponibilita: (value) => value,
}

type AllowedPayload = Record<string, unknown>

async function ensureManagerOrAdmin(): Promise<NextResponse | null> {
  const server = await createServerSupabaseClient()
  const {
    data: { user },
  } = await server.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { data: profile } = await server
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role
  if (role !== 'admin' && role !== 'manager') {
    return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
  }

  return null
}

function parseJsonBody(request: NextRequest) {
  return request
    .json()
    .catch(() => ({ parseError: NextResponse.json({ error: 'JSON non valido' }, { status: 400 }) }))
}

function buildAllowedFields(body: Record<string, unknown>): {
  allowed: AllowedPayload
  forbiddenKey?: string
} {
  const allowedEntries = Object.entries(FIELD_MAPPERS)
    .filter(([key]) => Object.prototype.hasOwnProperty.call(body, key))
    .map(([key, mapper]) => [key, mapper(body[key])])

  const allowed = Object.fromEntries(allowedEntries)

  const forbiddenKey = Object.keys(body).find(
    (key) => !FIELD_MAPPERS[key] && FORBIDDEN_FIELDS.includes(key as typeof FORBIDDEN_FIELDS[number])
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

    const authorizationResponse = await ensureManagerOrAdmin()
    if (authorizationResponse) {
      return authorizationResponse
    }

    const payload = await parseJsonBody(request)
    if ('parseError' in payload) {
      return payload.parseError
    }

    const body = payload as Record<string, unknown>
    const { allowed, forbiddenKey } = buildAllowedFields(body)

    if (forbiddenKey) {
      return NextResponse.json({ error: `Campo non modificabile: ${forbiddenKey}` }, { status: 400 })
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'Nessun campo aggiornabile fornito' }, { status: 400 })
    }

    console.log('🔄 API Update ordine:', id, 'Campi consentiti:', allowed)

    // Write with service role after server-side check
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await admin
      .from('ordini_materiali')
      .update({ ...allowed, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Ordine update error:', error)
      return NextResponse.json({ error: 'Errore aggiornamento ordine' }, { status: 500 })
    }

    return NextResponse.json({ success: true, ordine: data })

  } catch (e) {
    console.error('Ordine PATCH error:', e)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}
