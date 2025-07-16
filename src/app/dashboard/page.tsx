// app/dashboard/page.tsx - RIPRISTINO ESATTO DA GITHUB
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database.types';
import KanbanBoard from './_components/KanbanBoard';
import StatsBar from './_components/StatsBar';
import UserProfileHeader from './_components/UserProfileHeader';
import { BustaWithCliente } from '@/types/shared.types';
import DashboardActions from './_components/DashboardActions';

// ✅ FIX: Forza il dynamic rendering e disabilita la cache
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function DashboardPage() {
  console.log('🔍 Dashboard - Starting to load');
  
  const cookieStore = cookies();
  
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );

  console.log('🔍 Dashboard - Supabase client created');

  // Verifica autenticazione
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  console.log('🔍 Dashboard - User check:', user ? `Logged in as ${user.email}` : 'No user');
  
  if (userError) {
    console.error('🔍 Dashboard - User error:', userError);
  }

  // ✅ FIX: Fetch delle buste con TUTTI i campi cliente necessari
  console.log('🔍 Dashboard - Fetching buste...');
  const { data: buste, error } = await supabase
    .from('buste')
    .select(`
      *,
      clienti:cliente_id (
        nome,
        cognome,
        telefono,
        email,
        data_nascita,
        genere
      ),
      ordini_materiali (
        id,
        descrizione_prodotto,
        stato,
        da_ordinare,
        note
      ),
      rate_pagamenti (
        id,
        numero_rata,
        data_scadenza,
        is_pagata,
        reminder_attivo
      ),
      info_pagamenti (
        is_saldato,
        modalita_saldo
      )
    `)
    .order('data_apertura', { ascending: false })
    .order('updated_at', { ascending: false }); // ✅ Ordinamento anche per updated_at

  console.log('🔍 Dashboard - Buste fetch result:', error ? `Error: ${error.message}` : `Success: ${buste?.length || 0} buste`);
  
  if (buste) {
    console.log('🔍 Dashboard - Stati delle buste:', buste.map(b => ({ id: b.readable_id, stato: b.stato_attuale })));
  }

  if (error) {
    // ✅ SECURITY: Log dettagliato server-side, messaggio generico per utente
    console.error('Errore nel caricamento delle buste:', {
      error: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'SSR'
    });
    
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h2 className="text-red-800 font-medium">Errore nel caricamento</h2>
          <p className="text-red-700 text-sm mt-1">
            Si è verificato un errore durante il caricamento dei dati. 
            Riprova tra qualche istante o contatta il supporto se il problema persiste.
          </p>
          <div className="mt-3 flex space-x-2">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
            >
              Ricarica Pagina
            </button>
            <button
              onClick={() => window.location.href = '/login'}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
            >
              Torna al Login
            </button>
          </div>
          {/* Solo in sviluppo, mostra dettagli tecnici */}
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-3">
              <summary className="text-xs text-red-600 cursor-pointer">Dettagli Tecnici (Solo Dev)</summary>
              <pre className="text-xs text-red-600 mt-2 overflow-auto bg-red-100 p-2 rounded">
                {JSON.stringify(error, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }

  const busteWithCliente: BustaWithCliente[] = buste || [];
  console.log('🔍 Dashboard - Rendering with', busteWithCliente.length, 'buste');

  return (
    <div className="flex flex-col h-full">
      {/* Header Profilo Utente */}
      <UserProfileHeader />

      {/* Header con azioni */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">
              Gestione buste e lavorazioni in corso - {busteWithCliente.length} buste totali
            </p>
            {/* ✅ Debug info in development */}
            {process.env.NODE_ENV === 'development' && (
              <p className="text-xs text-gray-400 mt-1">
                Ultimo aggiornamento: {new Date().toLocaleTimeString('it-IT')}
              </p>
            )}
          </div>
          
          <DashboardActions totalBuste={busteWithCliente.length} />
        </div>
      </div>

      {/* Barra delle statistiche */}
      <StatsBar buste={busteWithCliente} />

      {/* Contenuto principale - Kanban Board */}
      <div className="flex-1 p-6 bg-gray-50 overflow-hidden">
        <KanbanBoard buste={busteWithCliente} />
      </div>
    </div>
  );
}