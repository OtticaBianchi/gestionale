export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError) {
    console.warn('track-time: unable to validate user', userError)
    return new NextResponse('Unauthorized', { status: 401 })
  }

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // ✅ SECURITY: Validazione input più robusta
  let duration: number;
  
  try {
    const body = await request.json();
    duration = body.duration;
  } catch (error) {
    return new NextResponse('Invalid JSON payload', { status: 400 });
  }

  // Validazione tipo e range
  if (typeof duration !== 'number' || 
      duration <= 0 || 
      duration > 86400 || // Massimo 24 ore
      !Number.isFinite(duration) || // Esclude NaN e Infinity
      duration % 1 !== 0) { // Solo numeri interi
    return new NextResponse('Invalid duration: must be a positive integer between 1 and 86400 seconds', { status: 400 });
  }

  try {
    // Chiama la Edge Function di Supabase passando il token di accesso
    const { error } = await supabase.functions.invoke('update-online-time', {
      body: { duration },
    })

    if (error) throw error

    return new NextResponse('OK', { status: 200 })
  } catch (error: any) {
    // ✅ SECURITY: Log dettagliato server-side, messaggio generico client-side
    console.warn('track-time: edge function failed, falling back to noop', {
      error: error?.message,
      userId: user.id,
      timestamp: new Date().toISOString(),
      duration
    });

    // Evita di bloccare il logout o altre operazioni se la funzione fallisce
    return new NextResponse('Accepted without edge update', { status: 202 });
  }
}
