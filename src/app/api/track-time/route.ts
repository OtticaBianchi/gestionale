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

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
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
    console.error('Error invoking Supabase function:', {
      error: error.message,
      userId: session.user.id,
      timestamp: new Date().toISOString(),
      duration
    });
    
    // Non esporre dettagli interni al client
    return new NextResponse('Internal server error occurred while tracking time', { status: 500 });
  }
}