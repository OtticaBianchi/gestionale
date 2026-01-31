// app/dashboard/buste/[id]/page.tsx
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database.types';
import { notFound } from 'next/navigation';
import BustaDetailClient from './_components/BustaDetailClient';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

type BustaDettagliata = Database['public']['Tables']['buste']['Row'] & {
  clienti: Database['public']['Tables']['clienti']['Row'] | null;
  profiles: Pick<Database['public']['Tables']['profiles']['Row'], 'full_name'> | null;
  controllo_profile: Pick<Database['public']['Tables']['profiles']['Row'], 'full_name'> | null;
  status_history: Array<
    Database['public']['Tables']['status_history']['Row'] & {
      profiles: Pick<Database['public']['Tables']['profiles']['Row'], 'full_name'> | null;
    }
  >;
  payment_plan?: (Database['public']['Tables']['payment_plans']['Row'] & {
    payment_installments: Database['public']['Tables']['payment_installments']['Row'][] | null;
  }) | null;
  info_pagamenti?: Pick<
    Database['public']['Tables']['info_pagamenti']['Row'],
    'is_saldato' | 'modalita_saldo' | 'importo_acconto' | 'ha_acconto' | 'prezzo_finale' | 'data_saldo' | 'updated_at'
  > | null;
};

interface BustaDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function BustaDetailPage({ params }: BustaDetailPageProps) {
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
          }
        },
      },
    }
  );

  const { data: busta, error } = await supabase
    .from('buste')
    .select(`
      *,
      clienti (*),
      profiles:creato_da (full_name),
      controllo_profile:controllo_completato_da (full_name),
      status_history (
        *,
        profiles:operatore_id (full_name)
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
      ),
      ordini_materiali (
        id,
        descrizione_prodotto,
        stato,
        stato_disponibilita,
        promemoria_disponibilita,
        note,
        needs_action,
        needs_action_done,
        needs_action_type,
        deleted_at
      )
    `)
    .eq('id', (await params).id)
    .order('data_ingresso', { 
      ascending: false,
      foreignTable: 'status_history' 
    })
    .single();

  if (error || !busta) {
    console.error('Errore nel caricamento della busta:', error);
    notFound();
  }

  const normalizedBusta = normalizePaymentPlanRelation(busta);
  // ✅ FIX: Filter out soft-deleted orders from ordini_materiali
  const bustaDettagliata: BustaDettagliata = {
    ...normalizedBusta,
    ordini_materiali: (normalizedBusta.ordini_materiali || []).filter(
      (ordine: { deleted_at?: string | null }) => !ordine.deleted_at
    )
  } as BustaDettagliata;

  return (
    <div className="relative min-h-screen bg-[var(--paper)] text-slate-900 kiasma-body overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(15,106,110,0.16),transparent_55%),radial-gradient(circle_at_80%_10%,rgba(178,115,75,0.16),transparent_45%),radial-gradient(circle_at_60%_80%,rgba(15,106,110,0.1),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(120deg,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(0deg,rgba(0,0,0,0.04)_1px,transparent_1px)] [background-size:40px_40px]" />

      {/* Header */}
      <div className="relative z-10 bg-white/80 border-b border-slate-200/70 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Torna al Dashboard</span>
              </Link>
              <div className="h-6 w-px bg-slate-300" />
              <div>
                <h1 className="kiasma-hero text-xl text-[var(--ink)]">
                  Busta {bustaDettagliata.readable_id}
                </h1>
                <p className="text-sm text-slate-500">
                  {bustaDettagliata.clienti?.cognome} {bustaDettagliata.clienti?.nome}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Status Badge */}
              <span className={`
                inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
                ${bustaDettagliata.stato_attuale === 'nuove' ? 'bg-blue-100/70 text-blue-800' :
                  bustaDettagliata.stato_attuale === 'consegnato_pagato' ? 'bg-green-100/70 text-green-800' :
                  bustaDettagliata.stato_attuale === 'pronto_ritiro' ? 'bg-purple-100/70 text-purple-800' :
                  'bg-yellow-100/70 text-yellow-800'}
              `}>
                {bustaDettagliata.stato_attuale.replace(/_/g, ' ').toUpperCase()}
              </span>
              
              {/* Priority Badge */}
              {bustaDettagliata.priorita !== 'normale' && (
                <span className={`
                  inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
                  ${bustaDettagliata.priorita === 'critica' ? 'bg-red-100/70 text-red-800' : 'bg-orange-100/70 text-orange-800'}
                `}>
                  {bustaDettagliata.priorita.toUpperCase()}
                </span>
              )}
              
              {/* Suspended Badge */}
              {bustaDettagliata.is_suspended && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100/70 text-yellow-800">
                  SOSPESO
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BustaDetailClient busta={bustaDettagliata} />
      </div>
    </div>
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
