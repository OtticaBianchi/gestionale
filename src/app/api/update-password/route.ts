export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    console.log('🔐 API - Password update request received')
    
    const { password } = await request.json()
    
    if (!password || password.length < 6) {
      return NextResponse.json({ 
        error: 'Password must be at least 6 characters long' 
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
    
    console.log('🔐 API - User check:', {
      hasUser: !!user,
      user: user?.email,
      error: userError?.message
    })

    if (!user) {
      return NextResponse.json({
        error: 'No valid session found. Please request a new password reset link.'
      }, { status: 401 })
    }

    // Update the password
    console.log('🔐 API - Updating password...')
    const { data: updateData, error: updateError } = await supabase.auth.updateUser({
      password: password
    })

    console.log('🔐 API - Update result:', {
      success: !updateError,
      error: updateError?.message,
      user: updateData.user?.email
    })

    if (updateError) {
      return NextResponse.json({
        error: `Password update failed: ${updateError.message}`
      }, { status: 400 })
    }

    console.log('🔐 API - Password updated successfully')
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
