export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { logInsert } from '@/lib/audit/auditLog'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables for admin import API')
}

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Solo gli admin possono importare clienti' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Payload non valido' }, { status: 400 })
    }

    const {
      cognome,
      nome,
      genere = null,
      telefono = null,
      email = null
    } = body

    if (!cognome?.trim() || !nome?.trim()) {
      return NextResponse.json({ error: 'Nome e cognome sono obbligatori' }, { status: 400 })
    }

    const { data: inserted, error } = await admin
      .from('clienti')
      .insert({
        cognome: cognome.trim(),
        nome: nome.trim(),
        genere,
        telefono: telefono?.trim() || null,
        email: email?.trim() || null
      })
      .select('id, nome, cognome, telefono')
      .single()

    if (error || !inserted) {
      return NextResponse.json({ error: error?.message || 'Errore creazione cliente' }, { status: 500 })
    }

    await logInsert(
      'clienti',
      inserted.id,
      user.id,
      {
        nome: inserted.nome,
        cognome: inserted.cognome,
        telefono: inserted.telefono
      },
      'Import massivo clienti',
      { source: 'admin/import-clienti' },
      profile.role
    )

    return NextResponse.json({ success: true, id: inserted.id })

  } catch (error: any) {
    console.error('POST /api/admin/import-clienti error:', error)
    return NextResponse.json({ error: error?.message || 'Errore interno server' }, { status: 500 })
  }
}
