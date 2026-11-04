export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { adminClient, requireUser, unauthorized } from '@/lib/preventivi/server'

export async function GET() {
  const user = await requireUser()
  if (!user) return unauthorized()

  const { data, error } = await adminClient()
    .from('preventivi_voci_catalogo')
    .select('id, nome, prezzo_default, garanzia_adattamento')
    .eq('attivo', true)
    .order('ordine', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ voci: data })
}
