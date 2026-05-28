export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data: snapshot, error } = await db
      .from('briefing_snapshots')
      .select(`
        *,
        generato_da_profile:generato_da(full_name),
        tasks:briefing_tasks(
          *,
          assegnato_a_profile:assegnato_a(full_name),
          busta:busta_id(
            readable_id,
            tipo_lavorazione,
            stato_attuale,
            priorita,
            note_generali,
            updated_at,
            clienti(nome, cognome, telefono)
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Snapshot non trovato' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({ snapshot })
  } catch (error) {
    console.error('[briefing/[id]] GET error:', error)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
