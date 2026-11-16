export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { setSessionAwareCookie, touchLastSeen } from '@/lib/supabase/session-cookies'
import { loginRateLimit, loginIpRateLimit, isLoginLocked, registerLoginFailure, clearLoginFailures } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const rl = await loginRateLimit(request)
    if (rl) return rl
    const rlIp = await loginIpRateLimit(request)
    if (rlIp) return rlIp

    const { email, password } = await request.json()

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({
        error: 'Email e password sono obbligatori'
      }, { status: 400 })
    }

    // Blocco per singolo account dopo troppi tentativi falliti (indipendente da IP/browser)
    const lock = await isLoginLocked(email)
    if (lock.locked) {
      return NextResponse.json(
        { error: 'Troppi tentativi falliti per questo account. Riprova tra qualche minuto.', retryAfter: lock.retryAfter },
        { status: 429, headers: { 'Retry-After': String(lock.retryAfter) } }
      )
    }

    logger.debug('🔐 SERVER LOGIN - Starting login attempt')

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            setSessionAwareCookie(cookieStore, name, value, options)
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    // Attempt login
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    logger.debug('🔐 SERVER LOGIN - Login result:', {
      success: !loginError,
      error: loginError?.message,
      userId: loginData.user?.id
    })

    if (loginError) {
      await registerLoginFailure(email)
      return NextResponse.json({
        error: loginError.message === 'Invalid login credentials' 
          ? 'Email o password non validi' 
          : loginError.message
      }, { status: 400 })
    }

    if (!loginData.user) {
      return NextResponse.json({
        error: 'Login fallito - nessun utente ricevuto'
      }, { status: 400 })
    }

    await clearLoginFailures(email)
    touchLastSeen(cookieStore)

    // Fetch user profile for role
    logger.debug('🔐 SERVER LOGIN - Fetching profile for:', loginData.user.id)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', loginData.user.id)
      .single()

    logger.debug('🔐 SERVER LOGIN - Profile result:', {
      profile: profile ? { role: profile.role } : null,
      error: profileError?.message
    })

    // Determine redirect URL based on role
    const role = profile?.role || 'operatore'
    const redirectUrl = '/dashboard' // Everyone goes to dashboard

    logger.debug('🔐 SERVER LOGIN - Success! Role:', role, 'Redirect:', redirectUrl)

    return NextResponse.json({
      success: true,
      user: {
        id: loginData.user.id,
        email: loginData.user.email,
        role: role,
        full_name: profile?.full_name || loginData.user.email
      },
      redirectUrl
    })

  } catch (error: any) {
    console.error('🔐 SERVER LOGIN - Unexpected error:', error)
    return NextResponse.json({
      error: 'Errore interno del server'
    }, { status: 500 })
  }
}