export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminClient, parsePreventivoBody, requireUser, unauthorized, verificaBusta } from '@/lib/preventivi/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await requireUser()
  if (!user) return unauthorized()

  const parsed = parsePreventivoBody(await request.json().catch(() => null))
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const bustaError = await verificaBusta(parsed.value.busta_id)
  if (bustaError) return NextResponse.json({ error: bustaError }, { status: 400 })

  // numero e data di stipula restano quelli originali
  const { data, error } = await adminClient()
    .from('preventivi')
    .update({ ...parsed.value, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ preventivo: data })
}
