export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminClient, oggiRomaIso, parsePreventivoBody, requireUser, unauthorized, verificaBusta } from '@/lib/preventivi/server'

// Preventivi, con ricerca per nome (?q=), filtro per stato (?stato=in_attesa|da_aprire|respinto|rielaborato) o per busta (?busta_id=)
export async function GET(request: NextRequest) {
  const user = await requireUser()
  if (!user) return unauthorized()

  const params = request.nextUrl.searchParams
  const q = params.get('q')?.trim().replace(/[%,()]/g, ' ')
  const stato = params.get('stato')
  const bustaId = params.get('busta_id')
  const admin = adminClient()

  let query = admin.from('preventivi').select('*').order('created_at', { ascending: false }).limit(stato && stato !== 'tutti' ? 300 : 60)
  if (q) query = query.or(`cliente_nome.ilike.%${q}%,cliente_cognome.ilike.%${q}%`)
  if (bustaId) query = query.eq('busta_id', bustaId)
  if (stato === 'in_attesa') query = query.eq('esito', 'in_attesa').is('busta_id', null)
  else if (stato === 'da_aprire') query = query.eq('esito', 'approvato').is('busta_id', null)
  else if (stato === 'respinto' || stato === 'rielaborato') query = query.eq('esito', stato)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Contatori dei filtri
  const conta = async (f: (qb: any) => any) => {
    const { count } = await f(admin.from('preventivi').select('id', { count: 'exact', head: true }))
    return count ?? 0
  }
  const conteggi = {
    in_attesa: await conta((qb) => qb.eq('esito', 'in_attesa').is('busta_id', null)),
    da_aprire: await conta((qb) => qb.eq('esito', 'approvato').is('busta_id', null)),
    respinto: await conta((qb) => qb.eq('esito', 'respinto')),
  }

  // Numero busta leggibile per i preventivi collegati (riferimento morbido, niente join)
  const bustaIds = Array.from(new Set((data || []).map((p: any) => p.busta_id).filter(Boolean)))
  const readable: Record<string, string> = {}
  if (bustaIds.length > 0) {
    const { data: buste } = await admin.from('buste').select('id, readable_id').in('id', bustaIds)
    for (const b of buste || []) readable[b.id] = b.readable_id
  }
  return NextResponse.json({
    preventivi: (data || []).map((p: any) => ({ ...p, busta_readable_id: p.busta_id ? readable[p.busta_id] ?? null : null })),
    conteggi,
  })
}

export async function POST(request: NextRequest) {
  const user = await requireUser()
  if (!user) return unauthorized()

  const body = await request.json().catch(() => null)
  const parsed = parsePreventivoBody(body)
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

  // Rielaborazione: il preventivo precedente passa a "rielaborato" e punta a questo
  const sostituisceId = typeof body?.sostituisce_id === 'string' ? body.sostituisce_id : null
  if (sostituisceId) {
    await admin
      .from('preventivi')
      .update({
        esito: 'rielaborato',
        esito_at: new Date().toISOString(),
        sostituito_da: data.id,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sostituisceId)
      .eq('esito', 'in_attesa')
  }
  return NextResponse.json({ preventivo: data })
}
