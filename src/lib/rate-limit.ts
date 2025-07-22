// src/lib/rate-limit.ts
import { NextRequest, NextResponse } from 'next/server';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store (per produzioni dovresti usare Redis)
const store: RateLimitStore = {};

// Cleanup vecchie entries ogni ora
setInterval(() => {
  const now = Date.now();
  for (const key in store) {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  }
}, 3600000); // 1 ora

export interface RateLimitOptions {
  windowMs?: number;  // Finestra temporale in ms (default: 15 minuti)
  maxRequests?: number;  // Max richieste per finestra (default: 100)
  message?: string;   // Messaggio di errore custom
  keyGenerator?: (req: NextRequest) => string;  // Generatore chiave custom
}

export function createRateLimit(options: RateLimitOptions = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minuti
    maxRequests = 100,
    message = 'Troppi tentativi. Riprova più tardi.',
    keyGenerator = (req) => {
      // Default: usa IP + User-Agent per identificare il client
      const forwarded = req.headers.get('x-forwarded-for');
      const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip || 'unknown';
      const userAgent = req.headers.get('user-agent') || 'unknown';
      return `${ip}:${userAgent}`;
    }
  } = options;

  return async function rateLimitMiddleware(req: NextRequest): Promise<NextResponse | null> {
    const key = keyGenerator(req);
    const now = Date.now();
    
    // Inizializza o recupera dati per questa chiave
    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 0,
        resetTime: now + windowMs
      };
    }
    
    // Incrementa counter
    store[key].count++;
    
    // Controlla se eccede il limite
    if (store[key].count > maxRequests) {
      const resetInSeconds = Math.ceil((store[key].resetTime - now) / 1000);
      
      return new NextResponse(JSON.stringify({
        error: message,
        retryAfter: resetInSeconds
      }), {
        status: 429, // Too Many Requests
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': resetInSeconds.toString(),
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(store[key].resetTime).toISOString()
        }
      });
    }
    
    // Aggiunge headers informativi
    const remaining = Math.max(0, maxRequests - store[key].count);
    
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