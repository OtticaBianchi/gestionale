export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const TABLES: Record<string, string> = {
  lenti: 'fornitori_lenti',
  montature: 'fornitori_montature',
  lac: 'fornitori_lac',
  sport: 'fornitori_sport',
  lab_esterno: 'fornitori_lab_esterno',
}

const selectable = 'id, nome, referente_nome, telefono, email, web_address, tempi_consegna_medi, note'
const TABLES_WITH_UPDATED_AT = new Set([
  'fornitori_lenti',
  'fornitori_montature',
  'fornitori_lac',
  'fornitori_sport',
])

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo') || ''
    const payload = await request.json()

    // Auth + role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || (profile.role !== 'admin' && profile.role !== 'manager')) {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
    }

    const table = TABLES[tipo]
    if (!table) return NextResponse.json({ error: 'Parametro tipo non valido' }, { status: 400 })

    const updates: Record<string, any> = {}
    ;['nome','referente_nome','telefono','email','web_address','tempi_consegna_medi','note'].forEach((k) => {
      if (k in payload) updates[k] = payload[k]
    })
    if (TABLES_WITH_UPDATED_AT.has(table)) {
      updates.updated_at = new Date().toISOString()
    }

    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const { data, error } = await admin.from(table).update(updates).eq('id', params.id).select(selectable).single()
    if (error) throw error
    return NextResponse.json({ item: data })
  } catch (e: any) {
    console.error('Fornitori PATCH error:', e)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}
