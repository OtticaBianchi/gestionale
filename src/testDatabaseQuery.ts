// Create a new file: testDatabaseQuery.ts

import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function testDatabaseQuery() {
  const supabase = await createServerSupabaseClient();

  try {
    console.log('Fetching buste from database...');
    const { data, error } = await supabase
      .from('buste')
      .select(`*, clienti:cliente_id (nome, cognome)`)
      .order('data_apertura', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching buste:', error);
      return;
    }

    console.log('Fetched buste:', data);
    console.log('Number of buste:', data?.length || 0);
  } catch (error) {
    console.error('Error in test script:', error);
  }
}
