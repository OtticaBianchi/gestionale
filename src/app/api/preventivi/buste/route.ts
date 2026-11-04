export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminClient, requireUser, unauthorized } from '@/lib/preventivi/server'

// Buste di un cliente (aperte per prime) da proporre per il collegamento di un preventivo
export async function GET(request: NextRequest) {
  const user = await requireUser()
  if (!user) return unauthorized()

  const clienteId = request.nextUrl.searchParams.get('cliente_id')
  if (!clienteId) return NextResponse.json({ error: 'cliente_id obbligatorio' }, { status: 400 })

  const { data, error } = await adminClient()
    .from('buste')
    .select('id, readable_id, tipo_lavorazione, stato_attuale, data_apertura')
    .eq('cliente_id', clienteId)
    .is('deleted_at', null)
    .order('data_apertura', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const buste = (data || [])
    .map((b: any) => ({ ...b, aperta: b.stato_attuale !== 'consegnato_pagato' }))
    .sort((a: any, b: any) => Number(b.aperta) - Number(a.aperta))
  return NextResponse.json({ buste })
}
