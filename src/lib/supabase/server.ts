// FILE server.ts - VERSIONE CORRETTA PER @supabase/ssr@0.6.1

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database.types'

/**
 * Crea un client Supabase per l'uso in Server Components, Route Handlers e Server Actions.
 * Questa versione utilizza la sintassi moderna e semplificata per @supabase/ssr@^0.6.0,
 * che non richiede la definizione manuale delle funzioni get/set/remove.
 * 
 * @returns Un'istanza del client Supabase per il server.
 */
export const createServerSupabaseClient = async () => {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}