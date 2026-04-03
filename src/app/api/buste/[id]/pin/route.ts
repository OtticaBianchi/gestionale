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
  if (typeof body.pinned_to_kanban !== 'boolean') {
    return NextResponse.json({ error: 'Campo pinned_to_kanban mancante o non booleano' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await admin
    .from('buste')
    .update({ pinned_to_kanban: body.pinned_to_kanban, updated_by: user.id })
    .eq('id', id)
    .select('id, readable_id, pinned_to_kanban')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logUpdate(
    'buste',
    id,
    user.id,
    { pinned_to_kanban: !body.pinned_to_kanban },
    { pinned_to_kanban: body.pinned_to_kanban }
  )

  return NextResponse.json(data)
}
