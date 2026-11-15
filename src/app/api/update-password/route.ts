export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { authRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

function isPasswordStrong(password: string): { valid: boolean; reason?: string } {
  if (password.length < 10) {
    return { valid: false, reason: 'La password deve contenere almeno 10 caratteri' }
  }
  if (!/[0-9!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, reason: 'La password deve contenere almeno un numero o simbolo' }
  }
  return { valid: true }
}

export async function POST(request: NextRequest) {
  try {
    const rl = await authRateLimit(request)
    if (rl) return rl

    logger.debug('🔐 API - Password update request received')

    const { password } = await request.json()

    if (!password) {
      return NextResponse.json({
        error: 'Password obbligatoria'
      }, { status: 400 })
    }

    const strength = isPasswordStrong(password)
    if (!strength.valid) {
      return NextResponse.json({
        error: strength.reason
      }, { status: 400 })
    }

    // Create Supabase client with server-side cookies
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

    // Get the authenticated user (validates token with Supabase Auth)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    logger.debug('🔐 API - User check:', {
      hasUser: !!user,
      userId: user?.id,
      error: userError?.message
    })

    if (!user) {
      return NextResponse.json({
        error: 'No valid session found. Please request a new password reset link.'
      }, { status: 401 })
    }

    // Update the password
    logger.debug('🔐 API - Updating password...')
    const { data: updateData, error: updateError } = await supabase.auth.updateUser({
      password: password
    })

    logger.debug('🔐 API - Update result:', {
      success: !updateError,
      error: updateError?.message,
      userId: updateData.user?.id
    })

    if (updateError) {
      return NextResponse.json({
        error: `Password update failed: ${updateError.message}`
      }, { status: 400 })
    }

    logger.debug('🔐 API - Password updated successfully')
    return NextResponse.json({ 
      success: true,
      message: 'Password updated successfully'
    })

  } catch (error: any) {
    console.error('🔐 API - Unexpected error:', error)
    return NextResponse.json({
      error: 'Unexpected error during password update'
    }, { status: 500 })
  }
}
