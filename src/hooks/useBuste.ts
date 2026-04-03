// hooks/useBuste.ts
import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { BustaWithCliente } from '@/types/shared.types';
import { shouldArchiveBusta } from '@/lib/buste/archiveRules';
import { DASHBOARD_BUSTE_SELECT } from '@/lib/buste/dashboardSelect';

const SWR_KEY = '/api/buste';
const ORDER_AUTO_SYNC_KEY = 'lastOrderAutoSyncCheck';
const ORDER_AUTO_SYNC_INTERVAL_MS = 15 * 60 * 1000;
const BUSTE_REFRESH_VISIBLE_MS = 5 * 60 * 1000; // 5 minutes

type UseBusteOptions = {
  enableAutoRefresh?: boolean;
  refreshIntervalMs?: number;
};

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

const shouldRunOrderAutoSync = (): boolean => {
  if (typeof window === 'undefined') return false;
  const now = Date.now();
  const rawLastRun = window.localStorage.getItem(ORDER_AUTO_SYNC_KEY);
  const lastRun = rawLastRun ? Number.parseInt(rawLastRun, 10) : 0;
  if (Number.isNaN(lastRun) || now - lastRun >= ORDER_AUTO_SYNC_INTERVAL_MS) {
    window.localStorage.setItem(ORDER_AUTO_SYNC_KEY, String(now));
    return true;
  }
  return false;
};

const fetcher = async (): Promise<BustaWithCliente[]> => {
  const supabase = createClient();
  
  console.log('🔍 SWR Fetcher - Starting buste fetch...');

  if (shouldRunOrderAutoSync()) {
    try {
      await fetch('/api/ordini/auto-sync', { method: 'POST' });
    } catch (syncError) {
      console.warn('⚠️ SWR Fetcher - Auto-sync ordini non disponibile:', syncError);
    }
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('buste')
    .select(DASHBOARD_BUSTE_SELECT)
    .is('deleted_at', null)
    .or(`stato_attuale.neq.consegnato_pagato,updated_at.gte.${sevenDaysAgo},pinned_to_kanban.eq.true`)
    .order('data_apertura', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('❌ SWR Fetcher - Error:', error);
    throw new Error(`Database error: ${error.message}`);
  }

  const allBuste = (data as unknown as BustaWithCliente[]) || [];
  // ✅ FIX: Filter out soft-deleted orders from ordini_materiali
  const normalizedBuste = (allBuste as any[]).map(busta => {
    const normalized = normalizePaymentPlanRelation(busta);
    return {
      ...normalized,
      ordini_materiali: (normalized.ordini_materiali || []).filter(
        (ordine: { deleted_at?: string | null }) => !ordine.deleted_at
      )
    };
  }) as BustaWithCliente[];

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

export function useBuste(initialData?: BustaWithCliente[], options: UseBusteOptions = {}) {
  const hasInitialData = Array.isArray(initialData);
  const enableAutoRefresh = options.enableAutoRefresh ?? true;
  const refreshIntervalMs = options.refreshIntervalMs ?? BUSTE_REFRESH_VISIBLE_MS;

  return useSWR<BustaWithCliente[]>(SWR_KEY, fetcher, {
    fallbackData: initialData,
    refreshInterval: () => {
      if (!enableAutoRefresh) return 0;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return 0;
      }
      return refreshIntervalMs;
    },
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: enableAutoRefresh,
    revalidateOnMount: enableAutoRefresh && !hasInitialData,
    revalidateIfStale: enableAutoRefresh && !hasInitialData,
    dedupingInterval: 2 * 60 * 1000,
    focusThrottleInterval: 5 * 60 * 1000,
    errorRetryCount: 3,
    errorRetryInterval: 4000,
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
