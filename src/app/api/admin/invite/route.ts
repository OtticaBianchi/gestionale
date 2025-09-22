export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { strictRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Basic rate limit (admin-only path, still useful)
  const rl = await strictRateLimit(request)
  if (rl) return rl

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  )

  // Ensure caller is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Solo gli amministratori possono invitare' }, { status: 403 })
  }

  // Parse body
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }

  const email = (body?.email || '').toString().trim().toLowerCase()
  const full_name = (body?.full_name || '').toString().trim()
  const role = (body?.role || '').toString().trim()

  const allowedRoles = new Set(['admin', 'manager', 'operatore'])
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email non valida' }, { status: 400 })
  }
  if (!allowedRoles.has(role)) {
    return NextResponse.json({ error: 'Ruolo non valido' }, { status: 400 })
  }

  // Use service role for admin invitation
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // Route invites to a client-side confirm page that can handle both #access_token and ?code flows
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
    const redirectTo = `${baseUrl}/auth/confirm?set_password=1`

    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name, role },
      redirectTo
    })
    if (error) throw error

    return NextResponse.json({ success: true, invited: { email, role } })
  } catch (error: any) {
    console.error('Admin invite error:', error)
    return NextResponse.json({ error: 'Invito fallito', details: error.message }, { status: 500 })
  }
}
