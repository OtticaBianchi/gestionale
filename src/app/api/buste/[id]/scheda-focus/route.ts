export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { logUpdate } from '@/lib/audit/auditLog'

const adminClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { data, error } = await adminClient()
    .from('buste')
    .select('scheda_focus_data_ordine, scheda_focus_fatta')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    scheda_focus_data_ordine: data.scheda_focus_data_ordine,
    scheda_focus_fatta: data.scheda_focus_fatta,
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body.fatta !== 'boolean') {
    return NextResponse.json({ error: 'Payload non valido' }, { status: 400 })
  }
  const fatta: boolean = body.fatta

  const admin = adminClient()

  const { data: current, error: readError } = await admin
    .from('buste')
    .select('scheda_focus_data_ordine, scheda_focus_fatta')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (readError || !current) {
    return NextResponse.json({ error: 'Busta non trovata' }, { status: 404 })
  }
  if (!current.scheda_focus_data_ordine) {
    return NextResponse.json({ error: 'Scheda Focus non ancora attiva per questa busta' }, { status: 409 })
  }

  const { error } = await admin
    .from('buste')
    .update({
      scheda_focus_fatta: fatta,
      scheda_focus_fatta_da: fatta ? user.id : null,
      scheda_focus_fatta_at: fatta ? new Date().toISOString() : null,
      updated_by: user.id,
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logUpdate(
    'buste',
    id,
    user.id,
    { scheda_focus_fatta: current.scheda_focus_fatta },
    { scheda_focus_fatta: fatta },
    fatta ? 'Scheda Focus segnata come fatta' : 'Scheda Focus segnata come non fatta'
  )

  return NextResponse.json({ success: true })
}
