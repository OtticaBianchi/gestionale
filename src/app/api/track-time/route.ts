export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const cookieStore = await cookies()
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
    const functionStatus = error?.context?.response?.status

    // ✅ SECURITY: Log dettagliato server-side, messaggio generico client-side
    console.warn('track-time: edge function failed, attempting service fallback', {
      error: error?.message,
      functionStatus,
      userId: user.id,
      timestamp: new Date().toISOString(),
      duration
    });

    // Fallback diretto alla RPC se l'Edge Function non è disponibile (es. 404) o ha fallito
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serviceRoleKey) {
      try {
        const admin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey
        )

        const { error: rpcError } = await admin.rpc('increment_online_time', {
          user_id_param: user.id,
          duration_param: duration
        })

        if (!rpcError) {
          console.info('track-time: service fallback succeeded')
          return new NextResponse('OK', { status: 200 })
        }

        console.warn('track-time: service fallback RPC failed', {
          rpcError: rpcError?.message,
          userId: user.id
        })
      } catch (fallbackError: any) {
        console.warn('track-time: service fallback threw', {
          error: fallbackError?.message,
          userId: user.id
        })
      }
    }

    // Evita di bloccare il logout o altre operazioni se la funzione fallisce
    return new NextResponse('Accepted without edge update', { status: 202 });
  }
}
