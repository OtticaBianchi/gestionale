export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminClient, requireUser, unauthorized } from '@/lib/preventivi/server'
import { MOTIVI_RESPINTO } from '@/lib/preventivi/types'

// Imposta l'esito del preventivo: in_attesa (riapre), approvato, respinto (con motivo).
// "rielaborato" non si imposta a mano: lo imposta il salvataggio come rielaborazione.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await requireUser()
  if (!user) return unauthorized()

  const body = await request.json().catch(() => null)
  const esito = body?.esito
  if (esito !== 'in_attesa' && esito !== 'approvato' && esito !== 'respinto') {
    return NextResponse.json({ error: 'Esito non valido' }, { status: 400 })
  }

  let categoria: string | null = null
  if (esito === 'respinto') {
    categoria = MOTIVI_RESPINTO.some((m) => m.id === body?.categoria) ? body.categoria : null
    if (!categoria) return NextResponse.json({ error: 'Scegli il motivo del rifiuto' }, { status: 400 })
  }
  const motivo = esito === 'in_attesa' ? null : String(body?.motivo ?? '').trim().slice(0, 500) || null

  const { error } = await adminClient()
    .from('preventivi')
    .update({
      esito,
      esito_at: esito === 'in_attesa' ? null : new Date().toISOString(),
      esito_categoria: categoria,
      esito_motivo: motivo,
      sostituito_da: null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
