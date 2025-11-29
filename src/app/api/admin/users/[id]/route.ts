export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { strictRateLimit } from '@/lib/rate-limit'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limit
  const rl = await strictRateLimit(request)
  if (rl) return rl

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'User ID mancante' }, { status: 400 })

  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: 'Solo gli amministratori possono modificare utenti' }, { status: 403 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }

  const updates: Record<string, any> = {}
  const metadataUpdates: Record<string, any> = {}
  let shouldToggleDisable = false

  if (typeof body.full_name === 'string') {
    updates.full_name = body.full_name.trim()
    metadataUpdates.full_name = updates.full_name
  }

  if (typeof body.role === 'string') {
    const role = body.role.trim()
    const allowed = new Set(['admin', 'manager', 'operatore'])
    if (!allowed.has(role)) {
      return NextResponse.json({ error: 'Ruolo non valido' }, { status: 400 })
    }
    updates.role = role
    metadataUpdates.role = role
  }

  if (typeof body.is_disabled === 'boolean') {
    shouldToggleDisable = true
    metadataUpdates.account_status = body.is_disabled ? 'disabled' : 'active'
    metadataUpdates.disabled_at = body.is_disabled ? new Date().toISOString() : null
  }

  if (!updates.full_name && !updates.role && !shouldToggleDisable) {
    return NextResponse.json({ error: 'Nessun campo valido da aggiornare' }, { status: 400 })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    let profile = null

    if (updates.full_name || updates.role) {
      const { data: updatedProfile, error: profileError } = await adminClient
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()

      if (profileError) throw profileError
      profile = updatedProfile
    }

    if (Object.keys(metadataUpdates).length > 0 || shouldToggleDisable) {
      let mergedMetadata = undefined

      if (Object.keys(metadataUpdates).length > 0) {
        const { data: authUser, error: fetchError } = await adminClient.auth.admin.getUserById(id)
        if (fetchError) throw fetchError

        mergedMetadata = {
          ...(authUser?.user?.user_metadata || {}),
          ...metadataUpdates
        }
      }

      const adminAttributes: {
        user_metadata?: Record<string, unknown>
        ban_duration?: string
      } = {}
      if (mergedMetadata) {
        adminAttributes.user_metadata = mergedMetadata
      }
      if (shouldToggleDisable) {
        adminAttributes.ban_duration = body.is_disabled ? '87600h' : 'none'
      }

      if (Object.keys(adminAttributes).length > 0) {
        const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(id, adminAttributes)
        if (updateAuthError) throw updateAuthError
      }
    }

    if (!profile) {
      const { data: currentProfile } = await adminClient
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single()
      profile = currentProfile
    }

    return NextResponse.json({ success: true, profile })
  } catch (error: any) {
    console.error('Admin update user error:', error)
    return NextResponse.json({ error: 'Aggiornamento fallito', details: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limit strictly for destructive action
  const rl = await strictRateLimit(request)
  if (rl) return rl

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'User ID mancante' }, { status: 400 })

  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: 'Solo gli amministratori possono eliminare utenti' }, { status: 403 })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const activityChecks: Array<{ table: string; columns: string[]; label: string }> = [
      { table: 'buste', columns: ['creato_da'], label: 'buste create' },
      { table: 'note', columns: ['utente_id'], label: 'note inserite' },
      { table: 'status_history', columns: ['operatore_id'], label: 'storico lavorazioni' },
      { table: 'kanban_update_logs', columns: ['user_id'], label: 'aggiornamenti kanban' },
      { table: 'follow_up_chiamate', columns: ['operatore_id'], label: 'chiamate follow-up' },
      { table: 'statistiche_follow_up', columns: ['operatore_id'], label: 'statistiche follow-up' },
      { table: 'procedures', columns: ['created_by', 'updated_by', 'last_reviewed_by'], label: 'procedure gestite' },
      { table: 'procedure_favorites', columns: ['user_id'], label: 'procedure preferite' },
      { table: 'error_tracking', columns: ['employee_id', 'reported_by', 'resolved_by'], label: 'tracciamento errori' },
      { table: 'voice_notes', columns: ['created_by', 'processed_by', 'assigned_to'], label: 'note vocali' },
    ]

    const blockingActivity: Array<{ table: string; label: string; column: string; count: number }> = []

    for (const target of activityChecks) {
      for (const column of target.columns) {
        const { error: countError, count } = await (adminClient as any)
          .from(target.table)
          .select('id', { head: true, count: 'exact' })
          .eq(column as string, id)

        if (countError) {
          // Ignore missing tables in environments where they might not exist
          if ((countError as any)?.code === '42P01') {
            continue
          }
          console.error('Admin delete user activity check error:', target.table, column, countError)
          return NextResponse.json({
            error: 'Impossibile verificare le attività utente',
            details: countError.message ?? countError,
          }, { status: 500 })
        }

        if ((count ?? 0) > 0) {
          blockingActivity.push({
            table: target.table,
            label: target.label,
            column,
            count: count ?? 0
          })
        }
      }
    }

    if (blockingActivity.length > 0) {
      return NextResponse.json({
        error: 'Impossibile eliminare l\'utente: esistono attività collegate',
        code: 'USER_HAS_ACTIVITY',
        activity: blockingActivity
      }, { status: 409 })
    }

    // Delete profile row (fail loudly if we still have dangling references)
    const { error: profileError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', id)

    if (profileError) {
      console.error('Admin delete user profile error:', profileError)
      return NextResponse.json({
        error: 'Impossibile eliminare il profilo associato',
        details: profileError.message ?? profileError,
      }, { status: 500 })
    }

    // Delete auth user
    const { error: delErr } = await adminClient.auth.admin.deleteUser(id)
    if (delErr) throw delErr

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Admin delete user error:', error)
    return NextResponse.json({ error: 'Eliminazione fallita', details: error.message }, { status: 500 })
  }
}
