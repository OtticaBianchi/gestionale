// hooks/useBuste.ts
import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { BustaWithCliente } from '@/types/shared.types';
import { shouldArchiveBusta } from '@/lib/buste/archiveRules';

const SWR_KEY = '/api/buste';

// Funzione helper per determinare se una busta è archiviata
const isArchived = (busta: any): boolean => shouldArchiveBusta(busta);

// Controllo archiviazione una volta al giorno
const shouldCheckArchiving = (): boolean => {
  const today = new Date().toDateString();
  const lastCheck = localStorage.getItem('lastArchiveCheck');
  
  if (lastCheck !== today) {
    localStorage.setItem('lastArchiveCheck', today);
    return true;
  }
  return false;
};

const normalizePaymentPlanRelation = (busta: any) => {
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
};

const fetcher = async (): Promise<BustaWithCliente[]> => {
  const supabase = createClient();
  
  console.log('🔍 SWR Fetcher - Starting buste fetch...');

  const { data, error } = await supabase
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
        stato_disponibilita,
        promemoria_disponibilita,
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
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('❌ SWR Fetcher - Error:', error);
    throw new Error(`Database error: ${error.message}`);
  }

  const allBuste = (data as unknown as BustaWithCliente[]) || [];
  const normalizedBuste = (allBuste as any[]).map(normalizePaymentPlanRelation) as BustaWithCliente[];

  // ✅ CONTROLLO ARCHIVIAZIONE - Solo una volta al giorno
  if (shouldCheckArchiving()) {
    const activeBuste = normalizedBuste.filter(busta => !isArchived(busta));
    const archivedCount = normalizedBuste.length - activeBuste.length;
    
    if (archivedCount > 0) {
      console.log('📁 ARCHIVING CHECK - Nascondendo', archivedCount, 'buste archiviate dalla Kanban (controllo giornaliero)');
    }
    
    return activeBuste;
  }

  // ✅ CONTROLLO GIÀ FATTO OGGI - Usa cache locale per performance
  const cachedFilteredBuste = normalizedBuste.filter(busta => !isArchived(busta));
  console.log('✅ SWR Fetcher - Success:', cachedFilteredBuste.length, 'active buste (archiving già controllato oggi)');
  
  return cachedFilteredBuste;
};

export function useBuste() {
  return useSWR<BustaWithCliente[]>(SWR_KEY, fetcher, {
    refreshInterval: 30000, // 30s polling fallback
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    revalidateOnMount: true,
    dedupingInterval: 2000, // 2s deduping - reduced for better responsiveness
    errorRetryCount: 3,
    errorRetryInterval: 2000,
    // ✅ Improved error handling
    onError: (error) => {
      console.error('🔥 SWR Error:', error);
    },
    // ✅ Enhanced success logging
    onSuccess: (data) => {
      console.log('✅ SWR Success - Cache updated with', data?.length || 0, 'buste at', new Date().toLocaleTimeString());
    }
  });
}

export { SWR_KEY };
