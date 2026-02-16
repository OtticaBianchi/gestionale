export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logUpdate } from '@/lib/audit/auditLog'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID ordine mancante' }, { status: 400 })
    }

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

    const role = profile?.role ?? null
    if (role !== 'admin' && role !== 'manager') {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const newDescription = typeof body?.descrizione_prodotto === 'string'
      ? body.descrizione_prodotto.trim()
      : ''

    if (!newDescription) {
      return NextResponse.json({ error: 'La descrizione è obbligatoria' }, { status: 400 })
    }

    const { data: existing, error: fetchError } = await supabase
      .from('ordini_materiali')
      .select('id, descrizione_prodotto, busta_id')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      console.error('Ordine non trovato per update descrizione:', fetchError)
      return NextResponse.json({ error: 'Ordine non trovato' }, { status: 404 })
    }

    if (existing.descrizione_prodotto?.trim() === newDescription) {
      return NextResponse.json({
        success: true,
        ordine: existing,
        message: 'Nessuna modifica necessaria'
      })
    }

    const { data: updated, error: updateError } = await supabase
      .from('ordini_materiali')
      .update({
        descrizione_prodotto: newDescription,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('id, descrizione_prodotto, busta_id, updated_by, updated_at')
      .single()

    if (updateError || !updated) {
      console.error('Errore aggiornamento descrizione ordine:', updateError)
      return NextResponse.json({ error: 'Errore aggiornamento descrizione' }, { status: 500 })
    }

    const audit = await logUpdate(
      'ordini_materiali',
      id,
      user.id,
      { descrizione_prodotto: existing.descrizione_prodotto },
      { descrizione_prodotto: newDescription },
      'Aggiornamento descrizione ordine',
      { bustaId: existing.busta_id },
      role
    )

    if (!audit.success) {
      console.error('AUDIT_ORDER_DESCRIPTION_FAILED', audit.error)
    }

    return NextResponse.json({ success: true, ordine: updated })

  } catch (error: any) {
    console.error('PATCH /api/ordini/[id]/description error:', error)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}
