export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logUpdate } from '@/lib/audit/auditLog'

// POST - Approve a pending procedure (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    // Admin check
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Solo admin possono approvare procedure' }, { status: 403 })
    }

    const { slug } = await params

    // Use service role for operations
    const adminClient = (await import('@supabase/supabase-js')).createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get existing procedure
    const { data: existing, error: fetchError } = await adminClient
      .from('procedures')
      .select('id, title, slug, approval_status')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Procedura non trovata' }, { status: 404 })
    }

    if (existing.approval_status === 'approved') {
      return NextResponse.json({ error: 'Procedura già approvata' }, { status: 400 })
    }

    // Update approval status
    const { data: updatedProcedure, error: updateError } = await adminClient
      .from('procedures')
      .update({
        approval_status: 'approved',
        updated_by: user.id
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error approving procedure:', updateError)
      return NextResponse.json({ error: 'Errore durante l\'approvazione' }, { status: 500 })
    }

    // Audit log
    const audit = await logUpdate(
      'procedures',
      existing.id,
      user.id,
      { approval_status: existing.approval_status },
      { approval_status: 'approved' },
      'Approvazione procedura',
      { source: 'api/procedures/[slug]/approve POST' },
      profile.role
    )

    if (!audit.success) {
      console.error('AUDIT_APPROVE_PROCEDURE_FAILED', audit.error)
    }

    return NextResponse.json({
      success: true,
      data: updatedProcedure,
      message: 'Procedura approvata e pubblicata con successo'
    })

  } catch (error) {
    console.error('Error in POST /api/procedures/[slug]/approve:', error)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}
