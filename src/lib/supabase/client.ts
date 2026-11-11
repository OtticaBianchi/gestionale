import { createBrowserClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import { Database } from '@/types/database.types'
import { toSessionCookieOptions } from './session-cookies'

/**
 * Crea un client Supabase per l'uso nel browser (Client Components).
 *
 * I cookie di sessione sono scritti come "session cookie" (senza maxAge a 400 giorni di
 * default) così non sopravvivono alla chiusura del browser: vedi session-cookies.ts.
 *
 * @returns Un'istanza del client Supabase per il browser.
 */
export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          if (typeof document === 'undefined') return []
          return parseCookieHeader(document.cookie).map(({ name, value }) => ({
            name,
            value: value ?? '',
          }))
        },
        setAll(cookiesToSet) {
          if (typeof document === 'undefined') return
          cookiesToSet.forEach(({ name, value, options }) => {
            document.cookie = serializeCookieHeader(name, value, toSessionCookieOptions(options))
          })
        },
      },
    }
  )
