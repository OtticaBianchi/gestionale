export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { logInsert, logUpdate } from '@/lib/audit/auditLog'

export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => null)
    const bustaId = body?.busta_id
    if (!bustaId) {
      return NextResponse.json({ error: 'busta_id mancante' }, { status: 400 })
    }

    const materialeEntry = {
      busta_id: bustaId,
      tipo: 'LAC',
      primo_acquisto_lac: !!body?.primo_acquisto_lac,
      note: body?.note ?? null,
      stato: body?.stato ?? 'attivo',
      updated_at: new Date().toISOString()
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: existing } = await admin
      .from('materiali')
      .select('*')
      .eq('busta_id', bustaId)
      .eq('tipo', 'LAC')
      .maybeSingle()

    if (existing) {
      const { error: updateError, data } = await admin
        .from('materiali')
        .update({
          primo_acquisto_lac: materialeEntry.primo_acquisto_lac,
          note: materialeEntry.note,
          stato: materialeEntry.stato,
          updated_at: materialeEntry.updated_at
        })
        .eq('id', existing.id)
        .select('*')
        .single()

      if (updateError || !data) {
        console.error('Errore aggiornamento materiali LAC:', updateError)
        return NextResponse.json({ error: 'Errore aggiornamento materiali' }, { status: 500 })
      }

      const audit = await logUpdate(
        'materiali',
        data.id,
        user.id,
        {
          primo_acquisto_lac: existing.primo_acquisto_lac,
          note: existing.note,
          stato: existing.stato
        },
        {
          primo_acquisto_lac: data.primo_acquisto_lac,
          note: data.note,
          stato: data.stato
        },
        'Aggiornamento entry materiali LAC',
        { bustaId },
        userRole
      )

      if (!audit.success) {
        console.error('AUDIT_UPDATE_MATERIALI_LAC_FAILED', audit.error)
      }

      return NextResponse.json({ success: true, materiale: data })

    } else {
      const { data: inserted, error: insertError } = await admin
        .from('materiali')
        .insert(materialeEntry)
        .select('*')
        .single()

      if (insertError || !inserted) {
        console.error('Errore creazione materiali LAC:', insertError)
        return NextResponse.json({ error: 'Errore creazione materiali' }, { status: 500 })
      }

      const audit = await logInsert(
        'materiali',
        inserted.id,
        user.id,
        {
          primo_acquisto_lac: inserted.primo_acquisto_lac,
          note: inserted.note,
          stato: inserted.stato,
          busta_id: bustaId
        },
        'Creazione entry materiali LAC',
        { bustaId },
        userRole
      )

      if (!audit.success) {
        console.error('AUDIT_INSERT_MATERIALI_LAC_FAILED', audit.error)
      }

      return NextResponse.json({ success: true, materiale: inserted })
    }

  } catch (error) {
    console.error('POST /api/materiali/lac error:', error)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}
