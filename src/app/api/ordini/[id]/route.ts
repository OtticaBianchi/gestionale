export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

// Manager/Admin endpoint to update safe operational fields on ordini_materiali
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    if (!id) return NextResponse.json({ error: 'ID mancante' }, { status: 400 })

    // Auth + role check
    const server = createServerSupabaseClient()
    const { data: { user } } = await server.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    const { data: profile } = await server
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = profile?.role
    if (role !== 'admin' && role !== 'manager') {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
    }

    // Parse body and whitelist updatable fields
    let body: any
    try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON non valido' }, { status: 400 }) }

    const allowed: any = {}
    if (body.stato !== undefined) allowed.stato = body.stato
    if (body.da_ordinare !== undefined) allowed.da_ordinare = !!body.da_ordinare
    if (body.data_consegna_prevista !== undefined) allowed.data_consegna_prevista = body.data_consegna_prevista
    if (body.data_consegna_effettiva !== undefined) allowed.data_consegna_effettiva = body.data_consegna_effettiva
    if (body.data_ordine !== undefined) allowed.data_ordine = body.data_ordine
    if (body.note !== undefined) allowed.note = body.note

    console.log('🔄 API Update ordine:', id, 'Campi consentiti:', allowed);

    // Disallow financial/foreign key changes in this endpoint
    const forbiddenKeys = ['busta_id','fornitore_id','fornitore_lenti_id','fornitore_lac_id','fornitore_montature_id','fornitore_lab_esterno_id','fornitore_sport_id','tipo_lenti_id','tipo_ordine_id','descrizione_prodotto','giorni_consegna_medi','giorni_ritardo','creato_da']
    for (const k of Object.keys(body || {})) {
      if (!Object.prototype.hasOwnProperty.call(allowed, k) && forbiddenKeys.includes(k)) {
        return NextResponse.json({ error: `Campo non modificabile: ${k}` }, { status: 400 })
      }
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'Nessun campo aggiornabile fornito' }, { status: 400 })
    }

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
