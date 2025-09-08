export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ 
        error: 'Email e password sono obbligatori' 
      }, { status: 400 })
    }

    console.log('🔐 SERVER LOGIN - Starting login for:', email)

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
            cookieStore.set({ name, value, ...options })
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

    console.log('🔐 SERVER LOGIN - Login result:', {
      success: !loginError,
      error: loginError?.message,
      user: loginData.user?.email
    })

    if (loginError) {
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

    // Fetch user profile for role
    console.log('🔐 SERVER LOGIN - Fetching profile for:', loginData.user.id)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', loginData.user.id)
      .single()

    console.log('🔐 SERVER LOGIN - Profile result:', {
      profile: profile ? { role: profile.role, full_name: profile.full_name } : null,
      error: profileError?.message
    })

    // Determine redirect URL based on role
    const role = profile?.role || 'operatore'
    const redirectUrl = '/dashboard' // Everyone goes to dashboard

    console.log('🔐 SERVER LOGIN - Success! Role:', role, 'Redirect:', redirectUrl)

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