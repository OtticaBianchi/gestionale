import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Gestione della richiesta pre-flight OPTIONS per il CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Crea un client Supabase con privilegi di amministratore
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Crea un client per ottenere l'utente dalla richiesta
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { duration } = await req.json()
    if (typeof duration !== 'number' || duration <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid duration' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Chiama la funzione RPC per aggiornare il tempo in modo atomico
    const { error: rpcError } = await supabaseAdmin.rpc('increment_online_time', {
      user_id_param: user.id,
      duration_param: Math.round(duration) // Assicurati sia un intero
    })

    if (rpcError) {
      // Se la chiamata RPC fallisce, lancia l'errore per catturarlo nel blocco catch
      throw rpcError
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    // --- INIZIO MODIFICA ---
    // Gestiamo il tipo 'unknown' dell'errore in modo sicuro
    let errorMessage = 'An unexpected error occurred.'
    if (error instanceof Error) {
      // Se è un vero oggetto Error, possiamo usare la sua proprietà .message
      errorMessage = error.message
    } else if (typeof error === 'object' && error !== null && 'message' in error) {
      // Se è un oggetto con una proprietà 'message' (come gli errori di Supabase)
      errorMessage = String((error as { message: unknown }).message)
    } else if (typeof error === 'string') {
      // Se l'errore è solo una stringa
      errorMessage = error
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
    // --- FINE MODIFICA ---
  }
})

/* To invoke locally: // <--- E QUESTO È IL BLOCCO DI COMMENTI SUCCESSIVO

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/update-online-time' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
