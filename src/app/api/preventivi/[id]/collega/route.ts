export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminClient, requireUser, unauthorized } from '@/lib/preventivi/server'

// Collega (o scollega) un preventivo a una busta. Con busta_id si allinea anche cliente_id.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await requireUser()
  if (!user) return unauthorized()

  const body = await request.json().catch(() => null)
  const bustaId: string | null = typeof body?.busta_id === 'string' && body.busta_id ? body.busta_id : null

  const admin = adminClient()
  const update: Record<string, unknown> = { busta_id: null, updated_by: user.id, updated_at: new Date().toISOString() }

  if (bustaId) {
    const { data: busta } = await admin
      .from('buste')
      .select('id, cliente_id')
      .eq('id', bustaId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!busta) return NextResponse.json({ error: 'Busta non trovata' }, { status: 404 })
    update.busta_id = busta.id
    if (busta.cliente_id) update.cliente_id = busta.cliente_id
  }

  const { error } = await admin.from('preventivi').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
