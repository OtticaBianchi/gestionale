export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { strictRateLimit } from '@/lib/rate-limit'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Rate limit
  const rl = await strictRateLimit(request)
  if (rl) return rl

  const { id } = params
  if (!id) return NextResponse.json({ error: 'User ID mancante' }, { status: 400 })

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  )

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

  const updates: any = {}
  const metadataUpdates: any = {}

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

  if (!updates.full_name && !updates.role) {
    return NextResponse.json({ error: 'Nessun campo valido da aggiornare' }, { status: 400 })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // Update profile table
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()

    if (profileError) throw profileError

    // Keep auth metadata in sync (best effort)
    if (Object.keys(metadataUpdates).length > 0) {
      await adminClient.auth.admin.updateUserById(id, { user_metadata: metadataUpdates })
    }

    return NextResponse.json({ success: true, profile })
  } catch (error: any) {
    console.error('Admin update user error:', error)
    return NextResponse.json({ error: 'Aggiornamento fallito', details: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Rate limit strictly for destructive action
  const rl = await strictRateLimit(request)
  if (rl) return rl

  const { id } = params
  if (!id) return NextResponse.json({ error: 'User ID mancante' }, { status: 400 })

  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  )

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
    // Null out foreign key references before removing the profile/auth user to avoid FK violations
    const fkCleanupTargets: Array<{ table: string; column: string }> = [
      { table: 'buste', column: 'creato_da' },
      { table: 'note', column: 'utente_id' },
      { table: 'status_history', column: 'operatore_id' },
      { table: 'follow_up_chiamate', column: 'operatore_id' },
      { table: 'statistiche_follow_up', column: 'operatore_id' },
    ]

    for (const target of fkCleanupTargets) {
      const { error: cleanupError } = await adminClient
        .from(target.table)
        .update({ [target.column]: null })
        .eq(target.column, id)

      if (cleanupError && cleanupError.code !== '42P01') {
        console.error('Admin delete user cleanup error:', target.table, cleanupError)
        return NextResponse.json({
          error: 'Impossibile eliminare l\'utente: pulizia riferimenti fallita',
          details: cleanupError.message ?? cleanupError,
        }, { status: 500 })
      }
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
