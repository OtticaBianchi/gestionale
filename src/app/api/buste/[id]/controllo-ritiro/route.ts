export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { logUpdate } from '@/lib/audit/auditLog'

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

  const body = await request.json()
  const { checklist, completato } = body

  if (typeof checklist !== 'object' || checklist === null || typeof completato !== 'boolean') {
    return NextResponse.json({ error: 'Payload non valido' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const updates: Record<string, unknown> = {
    controllo_ritiro_checklist: checklist,
    controllo_ritiro_completato: completato,
    updated_by: user.id,
  }

  if (completato) {
    updates.controllo_ritiro_completato_da = user.id
    updates.controllo_ritiro_completato_at = new Date().toISOString()
  } else {
    updates.controllo_ritiro_completato_da = null
    updates.controllo_ritiro_completato_at = null
  }

  const { error } = await admin
    .from('buste')
    .update(updates)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logUpdate(
    'buste',
    id,
    user.id,
    { controllo_ritiro_completato: !completato },
    { controllo_ritiro_completato: completato },
    completato ? 'Controllo qualità pre-ritiro completato' : 'Controllo qualità pre-ritiro annullato'
  )

  return NextResponse.json({ success: true })
}
