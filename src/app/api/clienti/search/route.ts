export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
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
      return NextResponse.json({ error: 'Errore nella ricerca clienti' }, { status: 500 });
    }

    if (!clienti || clienti.length === 0) {
      console.log('❌ No clients found for search term:', searchTerm);
      return NextResponse.json({ results: [] });
    }

    console.log(`✅ Found ${clienti.length} clients`);

    // ✅ FIXED N+1: Single query con JOIN per tutte le buste
    const clientIds = clienti.map(c => c.id);
    
    const { data: allBuste, error: busteError } = await supabase
      .from('buste')
      .select('id, readable_id, stato_attuale, data_apertura, updated_at, cliente_id')
      .in('cliente_id', clientIds)
      .order('data_apertura', { ascending: false });

    if (busteError) {
      console.error('Error fetching buste for clients:', busteError);
      return NextResponse.json({ error: 'Errore nel caricamento buste' }, { status: 500 });
    }

    // Group buste by cliente_id per performance 
    const busteByCliente = (allBuste || []).reduce((acc, busta) => {
      const clienteId = busta.cliente_id;
      if (clienteId) {
        if (!acc[clienteId]) acc[clienteId] = [];
        acc[clienteId].push(busta);
      }
      return acc;
    }, {} as Record<string, any[]>);

    // Build results without additional queries
    const results = clienti.map(cliente => ({
      cliente,
      buste: busteByCliente[cliente.id] || []
    }));

    console.log(`📋 Returning ${results.length} client results with their buste`);
    return NextResponse.json({ results });

  } catch (error) {
    console.error('Client search error:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
