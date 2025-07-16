// Questo file gestisce le intestazioni CORS per permettere al tuo frontend
// di comunicare con la Edge Function.

// ✅ FIX SICUREZZA: CORS specifico per ambiente
const getAllowedOrigin = () => {
  // In sviluppo, accetta solo localhost
  if (process.env.NODE_ENV === 'development' || !process.env.DENO_DEPLOYMENT_ID) {
    return 'http://localhost:3000';
  }
  
  // In produzione, usa variabile d'ambiente o fallback sicuro
  return process.env.ALLOWED_ORIGIN || 'https://localhost:3000';
};

export const corsHeaders = {
    'Access-Control-Allow-Origin': getAllowedOrigin(),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400', // Cache preflight per 24 ore
  }