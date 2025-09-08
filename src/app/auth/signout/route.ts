export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    console.log('🔐 SERVER SIGNOUT - Starting signout process')

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

    // Sign out from Supabase
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('🔐 SERVER SIGNOUT - Error:', error.message)
      return NextResponse.json({
        error: 'Errore durante il logout'
      }, { status: 400 })
    }

    console.log('🔐 SERVER SIGNOUT - Success!')

    return NextResponse.json({
      success: true,
      message: 'Logout effettuato con successo'
    })

  } catch (error: any) {
    console.error('🔐 SERVER SIGNOUT - Unexpected error:', error)
    return NextResponse.json({
      error: 'Errore interno del server'
    }, { status: 500 })
  }
}

// Handle GET requests too (for direct navigation)
export async function GET(request: NextRequest) {
  try {
    console.log('🔐 SERVER SIGNOUT - GET request, signing out and redirecting to login')
    
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

    // Sign out from Supabase
    await supabase.auth.signOut()

    console.log('🔐 SERVER SIGNOUT - GET signout successful, redirecting to login')

    // Redirect to login page
    return NextResponse.redirect(new URL('/login', request.url))

  } catch (error: any) {
    console.error('🔐 SERVER SIGNOUT - GET error:', error)
    // Still redirect to login even if signout fails
    return NextResponse.redirect(new URL('/login', request.url))
  }
}