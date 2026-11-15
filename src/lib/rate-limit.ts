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
