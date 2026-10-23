export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { fetchSchedeFocusMancanti } from '@/lib/scheda-focus/mancanti'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'manager') {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const { rows, error } = await fetchSchedeFocusMancanti(supabase)
  if (error) {
    console.error('Scheda Focus list error:', error)
    return NextResponse.json({ error: 'Errore nel caricamento' }, { status: 500 })
  }
  return NextResponse.json({ rows })
}
