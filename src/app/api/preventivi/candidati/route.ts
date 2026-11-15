export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminClient, requireUser, stessoCliente, unauthorized } from '@/lib/preventivi/server'

// Preventivi non ancora collegati a una busta (in attesa o approvati) dello stesso cliente,
// per proporli all'apertura della busta. Il cliente può non essere in anagrafica: si cerca anche per cellulare e nome.
export async function GET(request: NextRequest) {
  const user = await requireUser()
  if (!user) return unauthorized()

  const sp = request.nextUrl.searchParams
  const q = {
    cliente_id: sp.get('cliente_id'),
    telefono: sp.get('telefono'),
    cognome: sp.get('cognome'),
    nome: sp.get('nome'),
  }

  const { data, error } = await adminClient()
    .from('preventivi')
    .select('id, numero_label, cliente_id, cliente_cognome, cliente_nome, cliente_telefono, tipo, data_stipula, esito, versioni, righe')
    .in('esito', ['in_attesa', 'approvato'])
    .is('busta_id', null)
    .order('created_at', { ascending: false })
    .limit(300)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ preventivi: (data || []).filter((p: any) => stessoCliente(p, q)).slice(0, 10) })
}
