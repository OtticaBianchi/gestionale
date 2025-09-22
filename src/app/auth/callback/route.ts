import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const DEFAULT_REDIRECT = '/dashboard'
const ALLOWED_ROLES = new Set(['admin', 'manager', 'operatore'])

type SupabaseClient = ReturnType<typeof createServerClient>

type ExchangeResult = { user: any } | { response: NextResponse }

type ProfileResult = { profile: any } | { response: NextResponse }

async function createSupabaseClientWithCookies(): Promise<SupabaseClient> {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}

async function exchangeCodeForSession(
  supabase: SupabaseClient,
  code: string,
  origin: string
): Promise<ExchangeResult> {
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    console.error('🔍 CALLBACK ERROR - Exchange failed:', error)
    return { response: NextResponse.redirect(`${origin}/login?error=auth_error`) }
  }

  console.log('🔍 CALLBACK SUCCESS - User:', data.user?.email)
  return { user: data.user }
}

function resolveFullName(user: any) {
  return (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.identities?.[0]?.identity_data?.full_name ||
    user.email?.split('@')[0] ||
    'Utente'
  )
}

async function ensureProfile(
  supabase: SupabaseClient,
  user: any,
  origin: string
): Promise<ProfileResult> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('🔍 CALLBACK ERROR - Profile load failed:', error)
    return { response: NextResponse.redirect(`${origin}/login?error=profile_load_failed`) }
  }

  if (!profile) {
    const initialRole = ALLOWED_ROLES.has(user.user_metadata?.role) ? user.user_metadata.role : 'operatore'
    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        full_name: resolveFullName(user),
        role: initialRole,
      })
      .select('*')
      .single()

    if (insertError) {
      console.error('🔍 CALLBACK ERROR - Profile creation failed:', insertError)
      return { response: NextResponse.redirect(`${origin}/login?error=profile_creation_failed`) }
    }

    console.log('🔍 CALLBACK - Profile created successfully:', newProfile)
    return { profile: newProfile }
  }

  const invitedRole = user.user_metadata?.role
  if (invitedRole && ALLOWED_ROLES.has(invitedRole) && profile.role !== invitedRole) {
    const { data: synced, error: syncError } = await supabase
      .from('profiles')
      .update({ role: invitedRole, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('*')
      .single()

    if (!syncError && synced) {
      return { profile: synced }
    }
  }

  return { profile }
}

async function resolveNextPath(
  supabase: SupabaseClient,
  userId: string,
  requestedNext: string | null
) {
  if (requestedNext) {
    return requestedNext
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (profile && (profile.role === 'admin' || profile.role === 'manager')) {
    return DEFAULT_REDIRECT
  }

  return DEFAULT_REDIRECT
}

export async function GET(request: Request) {
  console.log('🔍 CALLBACK START')

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const origin = url.origin

  if (!code) {
    console.log('🔍 CALLBACK - No code provided, redirecting to login')
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const supabase = await createSupabaseClientWithCookies()
  const exchange = await exchangeCodeForSession(supabase, code, origin)
  if ('response' in exchange) {
    return exchange.response
  }

  const profileResult = await ensureProfile(supabase, exchange.user, origin)
  if ('response' in profileResult) {
    return profileResult.response
  }

  const nextPath = await resolveNextPath(
    supabase,
    exchange.user.id,
    url.searchParams.get('next')
  )

  const redirectUrl = `${origin}${nextPath}`
  console.log('🔍 CALLBACK - Redirecting to:', redirectUrl)
  return NextResponse.redirect(redirectUrl)
}
