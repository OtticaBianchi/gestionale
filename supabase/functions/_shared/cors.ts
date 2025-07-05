// Questo file gestisce le intestazioni CORS per permettere al tuo frontend
// di comunicare con la Edge Function.

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Per sviluppo. In produzione, metti il tuo dominio: 'https://tuo-sito.com'
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }