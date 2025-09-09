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

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo') || ''

    // Auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

    // Role check (manager or admin)
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || (profile.role !== 'admin' && profile.role !== 'manager')) {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
    }

    const table = TABLES[tipo]
    if (!table) return NextResponse.json({ error: 'Parametro tipo non valido' }, { status: 400 })

    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const { data, error } = await admin.from(table).select(selectable).order('nome', { ascending: true })
    if (error) throw error
    return NextResponse.json({ items: data || [] })
  } catch (e: any) {
    console.error('Fornitori GET error:', e)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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
    if (!payload?.nome) return NextResponse.json({ error: 'Nome richiesto' }, { status: 400 })

    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    const insert = {
      nome: payload.nome,
      referente_nome: payload.referente_nome ?? null,
      telefono: payload.telefono ?? null,
      email: payload.email ?? null,
      web_address: payload.web_address ?? null,
      tempi_consegna_medi: payload.tempi_consegna_medi ?? null,
      note: payload.note ?? null,
      created_at: new Date().toISOString(),
    }

    const { data, error } = await admin.from(table).insert(insert).select(selectable).single()
    if (error) throw error
    return NextResponse.json({ item: data })
  } catch (e: any) {
    console.error('Fornitori POST error:', e)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}

