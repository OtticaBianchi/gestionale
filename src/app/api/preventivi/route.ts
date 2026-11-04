export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminClient, oggiRomaIso, parsePreventivoBody, requireUser, unauthorized, verificaBusta } from '@/lib/preventivi/server'

// Ultimi preventivi, con ricerca facoltativa per nome cliente (?q=...)
export async function GET(request: NextRequest) {
  const user = await requireUser()
  if (!user) return unauthorized()

  const q = request.nextUrl.searchParams.get('q')?.trim().replace(/[%,()]/g, ' ')

  let query = adminClient().from('preventivi').select('*').order('created_at', { ascending: false }).limit(50)
  if (q) query = query.ilike('cliente_nome', `%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Numero busta leggibile per i preventivi collegati (riferimento morbido, niente join)
  const bustaIds = Array.from(new Set((data || []).map((p: any) => p.busta_id).filter(Boolean)))
  const readable: Record<string, string> = {}
  if (bustaIds.length > 0) {
    const { data: buste } = await adminClient().from('buste').select('id, readable_id').in('id', bustaIds)
    for (const b of buste || []) readable[b.id] = b.readable_id
  }
  return NextResponse.json({
    preventivi: (data || []).map((p: any) => ({ ...p, busta_readable_id: p.busta_id ? readable[p.busta_id] ?? null : null })),
  })
}

export async function POST(request: NextRequest) {
  const user = await requireUser()
  if (!user) return unauthorized()

  const parsed = parsePreventivoBody(await request.json().catch(() => null))
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const admin = adminClient()
  const bustaError = await verificaBusta(parsed.value.busta_id)
  if (bustaError) return NextResponse.json({ error: bustaError }, { status: 400 })

  const oggi = oggiRomaIso()
  const anno = Number(oggi.slice(0, 4))

  const { data: numero, error: numError } = await admin.rpc('next_preventivo_numero', { p_anno: anno })
  if (numError || typeof numero !== 'number') {
    return NextResponse.json({ error: numError?.message || 'Errore numerazione' }, { status: 500 })
  }

  const { data, error } = await admin
    .from('preventivi')
    .insert({
      ...parsed.value,
      anno,
      numero,
      numero_label: `PV-${anno}-${String(numero).padStart(4, '0')}`,
      data_stipula: oggi,
      created_by: user.id,
      updated_by: user.id,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ preventivo: data })
}
