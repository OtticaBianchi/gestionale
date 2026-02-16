export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { logInsert, logUpdate } from '@/lib/audit/auditLog'

type AuthResult =
  | { response: NextResponse }
  | { supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>; userId: string; role: string | null }

async function authenticate(): Promise<AuthResult> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { response: NextResponse.json({ error: 'Non autorizzato' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return { supabase, userId: user.id, role: profile?.role ?? null }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticate()
    if ('response' in auth) return auth.response
    const { supabase } = auth

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Busta ID mancante' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('info_pagamenti')
      .select('id, importo_acconto, ha_acconto')
      .eq('busta_id', id)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.error('Errore caricamento acconto:', error)
      return NextResponse.json({ error: 'Errore caricamento acconto' }, { status: 500 })
    }

    return NextResponse.json({ success: true, acconto: data ?? null })

  } catch (error) {
    console.error('GET /api/buste/[id]/acconto error:', error)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticate()
    if ('response' in auth) return auth.response
    const { userId, role } = auth
    if (role !== 'admin' && role !== 'manager') {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Busta ID mancante' }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    const importo = typeof body?.importo_acconto === 'number'
      ? body.importo_acconto
      : Number.parseFloat(body?.importo_acconto ?? '')

    if (Number.isNaN(importo) || importo < 0) {
      return NextResponse.json({ error: 'Importo non valido' }, { status: 400 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: existing } = await admin
      .from('info_pagamenti')
      .select('*')
      .eq('busta_id', id)
      .maybeSingle()

    const now = new Date().toISOString()
    const modalitaSaldo = existing?.modalita_saldo ?? 'saldo_unico'
    const dataAcconto = importo > 0 ? (existing?.data_acconto ?? now) : null

    const newData = {
      busta_id: id,
      importo_acconto: importo,
      ha_acconto: importo > 0,
      data_acconto: dataAcconto,
      modalita_saldo: modalitaSaldo,
      updated_at: now,
      updated_by: userId,
      ...(existing
        ? {}
        : {
            created_at: now,
            is_saldato: false
          })
    }

    const { data: upserted, error: upsertError } = await admin
      .from('info_pagamenti')
      .upsert(newData, { onConflict: 'busta_id' })
      .select('*')
      .single()

    if (upsertError || !upserted) {
      console.error('Errore salvataggio acconto:', upsertError)
      return NextResponse.json({
        error: 'Errore salvataggio acconto',
        details: upsertError?.message
      }, { status: 500 })
    }

    if (existing) {
      const audit = await logUpdate(
        'info_pagamenti',
        upserted.id,
        userId!,
        {
          importo_acconto: existing.importo_acconto,
          ha_acconto: existing.ha_acconto
        },
        {
          importo_acconto: upserted.importo_acconto,
          ha_acconto: upserted.ha_acconto
        },
        'Aggiornamento acconto',
        { bustaId: id },
        role ?? null
      )

      if (!audit.success) {
        console.error('AUDIT_ACCONTO_UPDATE_FAILED', audit.error)
      }
    } else {
      const audit = await logInsert(
        'info_pagamenti',
        upserted.id,
        userId!,
        {
          importo_acconto: upserted.importo_acconto,
          ha_acconto: upserted.ha_acconto,
          busta_id: id
        },
        'Creazione acconto',
        { bustaId: id },
        role ?? null
      )

      if (!audit.success) {
        console.error('AUDIT_ACCONTO_INSERT_FAILED', audit.error)
      }
    }

    return NextResponse.json({
      success: true,
      acconto: {
        importo_acconto: upserted.importo_acconto,
        ha_acconto: upserted.ha_acconto
      }
    })

  } catch (error) {
    console.error('PATCH /api/buste/[id]/acconto error:', error)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}
