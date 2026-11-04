export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminClient, requireUser, unauthorized } from '@/lib/preventivi/server'

// Cerca clienti in anagrafica per cognome, nome o cellulare (solo lettura)
export async function GET(request: NextRequest) {
  const user = await requireUser()
  if (!user) return unauthorized()

  const raw = (request.nextUrl.searchParams.get('q') || '').trim()
  const testo = raw.replace(/[%,()*\\]/g, ' ').replace(/\s+/g, ' ').trim()
  if (testo.length < 2) return NextResponse.json({ clienti: [] })

  const cifre = testo.replace(/\D/g, '')
  const filtri = [`cognome.ilike.%${testo}%`, `nome.ilike.%${testo}%`]
  // Il cellulare può essere salvato con spazi o trattini: confronto cifra per cifra
  if (cifre.length >= 4 && cifre.length >= testo.replace(/\s/g, '').length - 1) {
    filtri.push(`telefono.ilike.%${cifre.split('').join('%')}%`)
  }

  const { data, error } = await adminClient()
    .from('clienti')
    .select('id, nome, cognome, telefono')
    .is('deleted_at', null)
    .or(filtri.join(','))
    .order('cognome', { ascending: true })
    .limit(8)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ clienti: data })
}
