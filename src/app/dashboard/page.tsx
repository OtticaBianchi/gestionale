// app/dashboard/page.tsx - RIPRISTINO ESATTO DA GITHUB
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database.types';
import KanbanBoard from './_components/KanbanBoard';
import UserProfileHeader from './_components/UserProfileHeader';
import { BustaWithCliente } from '@/types/shared.types';
import ButtonsBar from './_components/ButtonsBar';
import ErrorActions from './_components/ErrorActions';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { shouldArchiveBusta } from '@/lib/buste/archiveRules';

// ✅ FIX: Forza il dynamic rendering e disabilita la cache
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function DashboardPage() {
  console.log('🔍 Dashboard - Starting to load');
  
  const cookieStore = await cookies();
  
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
      payment_plan:payment_plans (
        id,
        total_amount,
        acconto,
        payment_type,
        auto_reminders_enabled,
        reminder_preference,
        is_completed,
        payment_installments (
          id,
          installment_number,
          due_date,
          expected_amount,
          paid_amount,
          is_completed,
          reminder_3_days_sent,
          reminder_10_days_sent
        )
      ),
      info_pagamenti (
        is_saldato,
        modalita_saldo,
        importo_acconto,
        ha_acconto,
        prezzo_finale,
        data_saldo,
        updated_at
      )
    `)
    .order('data_apertura', { ascending: false })
    .order('updated_at', { ascending: false }); // ✅ Ordinamento anche per updated_at

  if (error) {
    return renderError(error);
  }

  const normalizedBuste = (buste || []).map(normalizePaymentPlanRelation) as BustaWithCliente[];
  const activeBuste = normalizedBuste.filter(busta => !shouldArchiveBusta(busta));

  console.log('🔍 Dashboard - Buste fetch result:', `Success: ${normalizedBuste.length} totali, ${activeBuste.length} attive`);
  console.log('🔍 Dashboard - Stati delle buste attive:', activeBuste.map(b => ({ id: b.readable_id, stato: b.stato_attuale })));

  return renderDashboard(activeBuste);
}

function renderError(error: { message: string; details?: string | null; hint?: string | null; code?: string | null }) {
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
          {/* Sposta le azioni in un client component per evitare problemi RSC */}
          <ErrorActions />
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

function renderDashboard(busteWithCliente: BustaWithCliente[]) {
  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        {/* Header Profilo Utente */}
        <UserProfileHeader />

        {/* Barra dei pulsanti */}
        <ButtonsBar />

        {/* Contenuto principale - Kanban Board */}
        <div className="flex-1 p-6 bg-gray-50 overflow-hidden">
          <KanbanBoard buste={busteWithCliente} />
        </div>
      </div>
    </DashboardLayout>
  );
}

function normalizePaymentPlanRelation(busta: any) {
  const rawPlan = busta.payment_plan;
  let normalizedPlan = null;

  if (Array.isArray(rawPlan)) {
    normalizedPlan = rawPlan[0] ?? null;
  } else if (rawPlan) {
    normalizedPlan = rawPlan;
  }

  if (normalizedPlan) {
    normalizedPlan = {
      ...normalizedPlan,
      payment_installments: Array.isArray(normalizedPlan.payment_installments)
        ? normalizedPlan.payment_installments
        : []
    };
  }

  return {
    ...busta,
    payment_plan: normalizedPlan,
  };
}
