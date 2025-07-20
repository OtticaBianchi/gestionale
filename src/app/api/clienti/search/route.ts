import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ results: [] });
    }

    const searchTerm = query.trim();
    console.log('🔍 Searching for clients with term:', searchTerm);

    // Search for clients by cognome or nome
    const { data: clienti, error: clientiError } = await supabase
      .from('clienti')
      .select('id, nome, cognome, telefono, email')
      .or(`cognome.ilike.%${searchTerm}%,nome.ilike.%${searchTerm}%`)
      .order('cognome')
      .order('nome')
      .limit(10);

    if (clientiError) {
      console.error('Database error searching clients:', clientiError);
      console.error('Full error details:', JSON.stringify(clientiError, null, 2));
      return NextResponse.json({ error: 'Errore nella ricerca clienti', details: clientiError }, { status: 500 });
    }

    if (!clienti || clienti.length === 0) {
      console.log('❌ No clients found for search term:', searchTerm);
      return NextResponse.json({ results: [] });
    }

    console.log(`✅ Found ${clienti.length} clients`);

    // For each client, get their buste
    const results = await Promise.all(
      clienti.map(async (cliente) => {
        const { data: buste, error: busteError } = await supabase
          .from('buste')
          .select('id, readable_id, stato_attuale, data_apertura, updated_at')
          .eq('cliente_id', cliente.id)
          .order('data_apertura', { ascending: false });

        if (busteError) {
          console.error(`Error fetching buste for client ${cliente.id}:`, busteError);
          return {
            cliente,
            buste: []
          };
        }

        return {
          cliente,
          buste: buste || []
        };
      })
    );

    console.log(`📋 Returning ${results.length} client results with their buste`);

    return NextResponse.json({ results });

  } catch (error) {
    console.error('Client search error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}