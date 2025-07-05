// FILE client.ts - VERSIONE CORRETTA PER @supabase/ssr@0.6.1
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database.types'

/**
 * Crea un client Supabase per l'uso nel browser (Client Components).
 * Questa versione utilizza la sintassi moderna e semplificata per @supabase/ssr@^0.6.0.
 *
 * @returns Un'istanza del client Supabase per il browser.
 */
export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    // Con le versioni recenti di @supabase/ssr, non è più necessario
    // passare l'oggetto 'cookies' per il client del browser,
    // in quanto la libreria gestisce i cookie del browser automaticamente.
  )