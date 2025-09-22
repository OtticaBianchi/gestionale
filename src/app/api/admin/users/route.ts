export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { apiRateLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  // Light rate limiting for admin list
  const rl = await apiRateLimit(request)
  if (rl) return rl

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  )

  // Ensure admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Solo gli amministratori possono accedere' }, { status: 403 })
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // List auth users (first page only; small org)
    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (listError) throw listError

    const authUsers = usersData?.users || []
    const userIds = authUsers.map(u => u.id)

    // Fetch profiles for all users
    const { data: profiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('*')
      .in('id', userIds)

    if (profilesError) throw profilesError

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

    const result = authUsers.map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: (u.last_sign_in_at || (u.last_sign_in_at as any)) ?? null,
      user_metadata: u.user_metadata || {},
      profile: profileMap.get(u.id) || null,
    }))

    return NextResponse.json({ users: result })
  } catch (error: any) {
    console.error('Admin users list error:', error)
    return NextResponse.json({ error: 'Errore caricamento utenti', details: error.message }, { status: 500 })
  }
}

