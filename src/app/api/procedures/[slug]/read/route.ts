export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getUnreadProceduresCount } from '@/lib/procedures/unread'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { slug } = await params

    const adminClient = (await import('@supabase/supabase-js')).createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: procedure, error: procedureError } = await adminClient
      .from('procedures')
      .select('id, updated_at, created_at, version, is_active')
      .eq('slug', slug)
      .single()

    if (procedureError || !procedure || procedure.is_active === false) {
      return NextResponse.json({ error: 'Procedura non trovata' }, { status: 404 })
    }

    const nowIso = new Date().toISOString()
    const acknowledgedUpdatedAt = procedure.updated_at || procedure.created_at || nowIso

    const { data: receipt, error: upsertError } = await adminClient
      .from('procedure_read_receipts')
      .upsert({
        procedure_id: procedure.id,
        user_id: user.id,
        acknowledged_at: nowIso,
        acknowledged_updated_at: acknowledgedUpdatedAt,
        acknowledged_version: procedure.version ?? null
      }, {
        onConflict: 'procedure_id,user_id'
      })
      .select('procedure_id, user_id, acknowledged_at, acknowledged_updated_at, acknowledged_version')
      .single()

    if (upsertError || !receipt) {
      console.error('Error upserting procedure read receipt:', upsertError)
      return NextResponse.json({ error: 'Errore nel salvataggio' }, { status: 500 })
    }

    const unreadCount = await getUnreadProceduresCount(adminClient, user.id)

    return NextResponse.json({
      success: true,
      receipt,
      unread_count: unreadCount
    })
  } catch (error) {
    console.error('Error in POST /api/procedures/[slug]/read:', error)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}
