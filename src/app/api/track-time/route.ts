import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  )

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { duration } = await request.json()

  if (typeof duration !== 'number' || duration <= 0) {
    return new NextResponse('Invalid input', { status: 400 })
  }

  try {
    // Chiama la Edge Function di Supabase passando il token di accesso
    const { error } = await supabase.functions.invoke('update-online-time', {
      body: { duration },
    })

    if (error) throw error

    return new NextResponse('OK', { status: 200 })
  } catch (error: any) {
    console.error('Error invoking Supabase function:', error)
    return new NextResponse(error.message, { status: 500 })
  }
}