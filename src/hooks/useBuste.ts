// hooks/useBuste.ts
import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { BustaWithCliente } from '@/types/shared.types';

const SWR_KEY = '/api/buste';

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
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('❌ SWR Fetcher - Error:', error);
    throw new Error(`Database error: ${error.message}`);
  }

  console.log('✅ SWR Fetcher - Success:', data?.length || 0, 'buste');
  return (data as BustaWithCliente[]) || [];
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