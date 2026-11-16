// src/lib/rate-limit.ts
//
// Rate limiter condiviso via Postgres (Supabase), non più in-memory: lo store
// in-memory veniva azzerato ad ogni cold start / istanza serverless diversa,
// rendendo il limite protezione apparente. Il conteggio è incrementato
// atomicamente lato DB (funzione rate_limit_hit, migrazione
// 20260807_add_rate_limit_counters.sql) per evitare race condition tra
// richieste concorrenti su istanze diverse.
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export interface RateLimitOptions {
  windowMs?: number;  // Finestra temporale in ms (default: 15 minuti)
  maxRequests?: number;  // Max richieste per finestra (default: 100)
  message?: string;   // Messaggio di errore custom
  keyGenerator?: (req: NextRequest) => string;  // Generatore chiave custom
}

// IP + User-Agent + path: non solo IP, altrimenti in un negozio con un solo
// IP pubblico tutti gli operatori condividerebbero lo stesso contatore e un
// collega che sbaglia la password potrebbe bloccare il login di un altro.
const defaultKeyGenerator = (req: NextRequest) => {
  const forwarded = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')
  const ip = forwarded ? forwarded.split(',')[0]?.trim() || 'unknown' : realIp || 'unknown'
  const userAgent = req.headers.get('user-agent') || 'unknown'
  return `${ip}:${userAgent}:${req.nextUrl.pathname}`
}

export function createRateLimit(options: RateLimitOptions = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minuti
    maxRequests = 100,
    message = 'Troppi tentativi. Riprova più tardi.',
    keyGenerator = defaultKeyGenerator
  } = options;

  return async function rateLimitMiddleware(req: NextRequest): Promise<NextResponse | null> {
    const key = keyGenerator(req);

    const { data, error } = await admin.rpc('rate_limit_hit', {
      p_key: key,
      p_window_ms: windowMs,
      p_max_requests: maxRequests
    })

    if (error) {
      // Fail-open: un problema infrastrutturale sul rate limiter non deve bloccare
      // l'operatività del negozio, ma va tracciato.
      console.error('❌ Rate limit check failed:', error.message)
      return null
    }

    const result = Array.isArray(data) ? data[0] : data
    if (!result) return null

    if (!result.allowed) {
      const resetAt = new Date(result.reset_at)
      const retryAfter = Math.max(0, Math.ceil((resetAt.getTime() - Date.now()) / 1000))

      return new NextResponse(JSON.stringify({
        error: message,
        retryAfter
      }), {
        status: 429, // Too Many Requests
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetAt.toISOString()
        }
      });
    }

    return null; // Continua con la richiesta normale
  };
}

// Preset comuni
export const strictRateLimit = createRateLimit({
  windowMs: 5 * 60 * 1000, // 5 minuti
  maxRequests: 10,
  message: 'Limite richieste API raggiunto. Riprova tra 5 minuti.'
});

export const apiRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  maxRequests: 100
});

export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  maxRequests: 5,
  message: 'Troppi tentativi di accesso. Riprova tra 15 minuti.'
});

// Login: il negozio ha un solo IP pubblico e browser identici, quindi il contatore è
// condiviso da tutti i PC; con scadenza sessione a 10 min i login sono frequenti.
// Soglia larga: ferma un brute force automatico ma non blocca il personale.
export const loginRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  maxRequests: 40,
  message: 'Troppi tentativi di accesso. Riprova tra qualche minuto.'
});

// ---------------------------------------------------------------------------
// Blocco per singolo account sul login (anti brute-force "lento" / cambio User-Agent)
// ---------------------------------------------------------------------------
// Conta solo i tentativi FALLITI per email (hash, non in chiaro): dopo
// LOGIN_FAIL_MAX errori in LOGIN_FAIL_WINDOW_MS l'account resta bloccato fino alla
// scadenza della finestra, anche con IP/browser diversi. Un login riuscito azzera
// il contatore, così il personale che sbaglia la password ogni tanto non resta bloccato.
// Usa la tabella rate_limit_counters già esistente: nessuna modifica al database.
export const LOGIN_FAIL_MAX = 6
export const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000

export function loginFailKey(email: string): string {
  const normalized = String(email).trim().toLowerCase()
  return 'loginfail:' + createHash('sha256').update(normalized).digest('hex')
}

export async function isLoginLocked(email: string): Promise<{ locked: boolean; retryAfter: number }> {
  const { data, error } = await admin
    .from('rate_limit_counters')
    .select('count, reset_at')
    .eq('key', loginFailKey(email))
    .maybeSingle()

  if (error || !data) return { locked: false, retryAfter: 0 }  // fail-open come il resto del limiter

  const resetAt = new Date(data.reset_at).getTime()
  if (resetAt > Date.now() && data.count >= LOGIN_FAIL_MAX) {
    return { locked: true, retryAfter: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)) }
  }
  return { locked: false, retryAfter: 0 }
}

export async function registerLoginFailure(email: string): Promise<void> {
  const { error } = await admin.rpc('rate_limit_hit', {
    p_key: loginFailKey(email),
    p_window_ms: LOGIN_FAIL_WINDOW_MS,
    p_max_requests: LOGIN_FAIL_MAX
  })
  if (error) console.error('❌ registerLoginFailure failed:', error.message)
}

export async function clearLoginFailures(email: string): Promise<void> {
  const { error } = await admin.from('rate_limit_counters').delete().eq('key', loginFailKey(email))
  if (error) console.error('❌ clearLoginFailures failed:', error.message)
}

// Limite per solo IP (senza User-Agent): chi cambia browser a ogni richiesta non lo aggira.
// Soglia alta perché il negozio ha un unico IP pubblico condiviso da tutti i PC.
export const loginIpRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 150,
  message: 'Troppi tentativi di accesso da questa rete. Riprova tra qualche minuto.',
  keyGenerator: (req: NextRequest) => {
    const forwarded = req.headers.get('x-forwarded-for')
    const realIp = req.headers.get('x-real-ip')
    const ip = forwarded ? forwarded.split(',')[0]?.trim() || 'unknown' : realIp || 'unknown'
    return `loginip:${ip}`
  }
})


// ---------------------------------------------------------------------------
// Limite per UTENTE LOGGATO sulle rotte costose (ricerca, analytics, report).
// La chiave è l'id utente, non l'IP: il negozio ha un solo IP pubblico condiviso, quindi un
// limite per IP bloccherebbe tutti i colleghi insieme. Serve a fermare un account compromesso
// (o uno script) che martella le query pesanti e consuma risorse/Supabase/Vercel.
// Fail-open come il resto del limiter.
export async function userRateLimit(
  userId: string,
  bucket: string,
  maxRequests: number,
  windowMs: number = 60 * 1000
): Promise<NextResponse | null> {
  const { data, error } = await admin.rpc('rate_limit_hit', {
    p_key: `user:${userId}:${bucket}`,
    p_window_ms: windowMs,
    p_max_requests: maxRequests
  })
  if (error) {
    console.error('❌ userRateLimit check failed:', error.message)
    return null
  }
  const result = Array.isArray(data) ? data[0] : data
  if (!result || result.allowed) return null

  const retryAfter = Math.max(1, Math.ceil((new Date(result.reset_at).getTime() - Date.now()) / 1000))
  return new NextResponse(JSON.stringify({ error: 'Troppe richieste. Riprova tra qualche secondo.', retryAfter }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) }
  })
}
