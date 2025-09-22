'use client';

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database.types'
import { Loader2 } from 'lucide-react'

const DEFAULT_REDIRECT = '/dashboard'
const ALLOWED_ROLES = new Set(['admin', 'manager', 'operatore'])

const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type UrlTokens = {
  code: string | null
  accessToken: string | null
  refreshToken: string | null
  redirectToPassword: boolean
}

type SupabaseUser = Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']

function parseUrlTokens(): UrlTokens {
  if (typeof window === 'undefined') {
    return { code: null, accessToken: null, refreshToken: null, redirectToPassword: false }
  }

  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  const hashParams = new URLSearchParams(hash)
  const searchParams = new URLSearchParams(window.location.search)

  return {
    code: searchParams.get('code'),
    accessToken: hashParams.get('access_token'),
    refreshToken: hashParams.get('refresh_token'),
    redirectToPassword: searchParams.get('set_password') === '1',
  }
}

async function exchangeSession(tokens: UrlTokens) {
  if (tokens.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(tokens.code)
    if (error) {
      throw new Error(error.message || 'Exchange failed')
    }
    return
  }

  if (tokens.accessToken && tokens.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    })
    if (error) {
      throw new Error(error.message || 'Session restore failed')
    }
    return
  }

  throw new Error('Link non valido o scaduto')
}

function resolveFullName(user: SupabaseUser) {
  return (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.identities?.[0]?.identity_data?.full_name ||
    user?.email?.split('@')[0] ||
    'Utente'
  )
}

async function ensureProfile(user: SupabaseUser) {
  if (!user) return

  const invitedRole = user.user_metadata?.role
  const targetRole = ALLOWED_ROLES.has(invitedRole) ? invitedRole : 'operatore'
  const fullName = resolveFullName(user)

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error && (error as any).code !== 'PGRST116') {
    console.error('🔍 CALLBACK ERROR - Profile load failed:', error)
    throw new Error('Impossibile caricare il profilo')
  }

  if (!profile) {
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({ id: user.id, full_name: fullName, role: targetRole })
    if (insertError) {
      console.error('🔍 CALLBACK ERROR - Profile creation failed:', insertError)
      throw new Error('Creazione profilo non riuscita')
    }
    return
  }

  if (targetRole && profile.role !== targetRole) {
    if (ALLOWED_ROLES.has(targetRole)) {
      await supabase
        .from('profiles')
        .update({ role: targetRole, updated_at: new Date().toISOString() })
        .eq('id', user.id)
    }
  }
}

async function computeRedirectPath(userId: string, requestedNext: string | null) {
  if (requestedNext) {
    return requestedNext
  }

  if (!userId) {
    return DEFAULT_REDIRECT
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

async function handleAuthFlow(setError: (message: string | null) => void) {
  try {
    const url = typeof window !== 'undefined' ? new URL(window.location.href) : null
    if (!url) {
      return
    }

    const tokens = parseUrlTokens()
    await exchangeSession(tokens)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    await ensureProfile(user)

    if (tokens.redirectToPassword) {
      window.location.replace('/auth/set-password')
      return
    }

    const redirectPath = await computeRedirectPath(user?.id || '', url.searchParams.get('next'))
    window.location.replace(`${url.origin}${redirectPath}`)
  } catch (error: any) {
    console.error('Auth confirm error:', error)
    setError(error.message || 'Errore autenticazione')
  }
}

export default function AuthConfirmPage() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    handleAuthFlow(setError)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-6 rounded-md shadow border border-gray-200 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
        <p className="text-gray-700">Conferma autenticazione in corso...</p>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>
    </div>
  )
}
