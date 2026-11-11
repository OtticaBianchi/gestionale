// Gestione della durata della sessione.
//
// Problema: @supabase/ssr scrive i cookie di sessione con maxAge = 400 giorni, quindi
// spegnendo il PC senza fare logout la sessione dell'utente della sera prima resta nel
// browser e il mattino dopo chi accende il PC entra come lui (il middleware rimanda
// /login → /dashboard perché il cookie è ancora valido).
//
// Difesa a due livelli:
//  1. i cookie di sessione Supabase diventano "session cookie" (niente maxAge/expires):
//     spariscono alla chiusura del browser;
//  2. un cookie `kiasma_last_seen` (anch'esso di sessione) registra l'ultima attività reale
//     dell'utente (login + heartbeat dal client); se manca o è più vecchio di IDLE_TIMEOUT_MS
//     il middleware chiude la sessione.
//     Copre anche il "riapri le schede precedenti" di Chrome, che ripristina i session cookie.

export const LAST_SEEN_COOKIE = 'kiasma_last_seen'

// Inattività massima: oltre questa soglia la sessione viene chiusa (client e middleware).
export const IDLE_TIMEOUT_MS = 10 * 60 * 1000

// Il client invia un heartbeat all'attività dell'utente al massimo ogni 30s.
// Le richieste automatiche (polling SWR) NON aggiornano `kiasma_last_seen`.
export const HEARTBEAT_INTERVAL_MS = 30 * 1000

type CookieOptions = Record<string, any>

/** Trasforma le opzioni di un cookie in quelle di un cookie di sessione, lasciando intatte le cancellazioni. */
export function toSessionCookieOptions(options?: CookieOptions): CookieOptions {
  const { maxAge, expires, ...rest } = options || {}
  const isDeletion = (typeof maxAge === 'number' && maxAge <= 0) ||
    (expires instanceof Date && expires.getTime() <= Date.now())
  return isDeletion ? { ...rest, maxAge, expires } : rest
}

export function lastSeenCookieOptions(): CookieOptions {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  }
}

export function isSessionExpired(lastSeenValue: string | undefined, now = Date.now()): boolean {
  if (!lastSeenValue) return true
  const last = Number(lastSeenValue)
  if (!Number.isFinite(last)) return true
  return now - last > IDLE_TIMEOUT_MS
}

/**
 * Scrive un cookie tramite il cookie store di Next rendendo di sessione i cookie `sb-*`
 * (non tocca `kiasma_last_seen`: i refresh del token non sono attività dell'utente).
 * Usare in tutti i `set`/`setAll` dei client Supabase lato server.
 */
export function setSessionAwareCookie(
  store: { set: (opts: any) => unknown },
  name: string,
  value: string,
  options?: CookieOptions
) {
  const isAuthCookie = name.startsWith('sb-')
  store.set({ name, value, ...(isAuthCookie ? toSessionCookieOptions(options) : options) })
}

/** Segna "adesso" come ultima attività dell'utente (login, callback, heartbeat). */
export function touchLastSeen(store: { set: (opts: any) => unknown }) {
  store.set({ name: LAST_SEEN_COOKIE, value: String(Date.now()), ...lastSeenCookieOptions() })
}
