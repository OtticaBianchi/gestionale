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
export const createServerSupabaseClient = () => {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Con la versione 0.6.x di @supabase/ssr, è sufficiente passare
      // direttamente l'oggetto 'cookies' ottenuto da Next.js.
      // La libreria rileverà automaticamente le funzioni necessarie.
      cookies: cookieStore,
    }
  )
}