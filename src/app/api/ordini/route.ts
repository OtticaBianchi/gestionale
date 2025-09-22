export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// List ordini_materiali with optional status filter and overdue logic
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // da_ordinare | ordinato | in_arrivo | in_ritardo | consegnato | all

    // Auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

    // Role check (manager or admin)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = profile?.role
    if (role !== 'admin' && role !== 'manager') {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
    }

    // Use service role to bypass restrictive RLS safely after role check
    const admin = (await import('@supabase/supabase-js')).createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Base query
    let query = admin
      .from('ordini_materiali')
      .select(`
        *,
        buste:busta_id (id, readable_id, stato_attuale, clienti:cliente_id (id, nome, cognome, telefono))
      `)
      .order('data_ordine', { ascending: false })

    if (status && status !== 'all') {
      if (status === 'in_ritardo') {
        const today = new Date().toISOString()
        query = query
          .neq('stato', 'consegnato' as any)
          .lt('data_consegna_prevista', today)
      } else {
        query = query.eq('stato', status)
      }
    }

    const { data, error } = await query
    if (error) {
      console.error('Ordini list error:', error)
      return NextResponse.json({ error: 'Errore caricamento ordini' }, { status: 500 })
    }

    return NextResponse.json({ ordini: data || [] })
  } catch (e) {
    console.error('Ordini GET error:', e)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}
