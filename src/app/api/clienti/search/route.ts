export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const normalizeSearchValue = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const matchesWordStart = (value: string | null | undefined, term: string) => {
  if (!value || !term) return false;
  const normalizedValue = normalizeSearchValue(value);
  const normalizedTerm = normalizeSearchValue(term);
  if (!normalizedValue || !normalizedTerm) return false;
  const regex = new RegExp(`(^|[\\s\\-'/,\\.])${escapeRegex(normalizedTerm)}`, 'i');
  return regex.test(normalizedValue);
};

const getClientSearchScore = (
  cliente: { nome?: string | null; cognome?: string | null },
  term: string
) => {
  const normalizedTerm = normalizeSearchValue(term);
  const normalizedNome = normalizeSearchValue(cliente.nome || '');
  const normalizedCognome = normalizeSearchValue(cliente.cognome || '');

  if (!normalizedTerm) return 99;
  if (normalizedCognome === normalizedTerm) return 0;
  if (normalizedNome === normalizedTerm) return 1;
  if (normalizedCognome.startsWith(normalizedTerm)) return 2;
  if (normalizedNome.startsWith(normalizedTerm)) return 3;
  if (matchesWordStart(cliente.cognome, term)) return 4;
  if (matchesWordStart(cliente.nome, term)) return 5;
  if (normalizedCognome.includes(normalizedTerm)) return 6;
  if (normalizedNome.includes(normalizedTerm)) return 7;
  return 99;
};

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
    const selectFields = 'id, nome, cognome, telefono, email, updated_at';
    const [cognomeRes, nomeRes] = await Promise.all([
      supabase
        .from('clienti')
        .select(selectFields)
        .is('deleted_at', null)
        .ilike('cognome', `%${searchTerm}%`)
        .limit(200),
      supabase
        .from('clienti')
        .select(selectFields)
        .is('deleted_at', null)
        .ilike('nome', `%${searchTerm}%`)
        .limit(200),
    ]);

    if (cognomeRes.error || nomeRes.error) {
      console.error('Database error searching clients:', cognomeRes.error || nomeRes.error);
      return NextResponse.json({ error: 'Errore nella ricerca clienti' }, { status: 500 });
    }

    const combinedClienti = [...(cognomeRes.data || []), ...(nomeRes.data || [])];
    const uniqueClienti = Array.from(
      combinedClienti.reduce((acc, cliente) => {
        acc.set(cliente.id, cliente);
        return acc;
      }, new Map<string, any>()).values()
    );
    const filteredClienti = uniqueClienti
      .map((cliente) => ({
        cliente,
        score: getClientSearchScore(cliente, searchTerm),
        updatedAtMs: cliente.updated_at ? new Date(cliente.updated_at).getTime() : 0,
      }))
      .filter(({ score }) => score < 99)
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        if (a.updatedAtMs !== b.updatedAtMs) return b.updatedAtMs - a.updatedAtMs;
        const cognomeA = (a.cliente.cognome || '').toLowerCase();
        const cognomeB = (b.cliente.cognome || '').toLowerCase();
        if (cognomeA !== cognomeB) return cognomeA.localeCompare(cognomeB);
        return (a.cliente.nome || '').toLowerCase().localeCompare((b.cliente.nome || '').toLowerCase());
      })
      .slice(0, 30)
      .map(({ cliente }) => cliente);

    if (filteredClienti.length === 0) {
      console.log('❌ No clients found for search term:', searchTerm);
      return NextResponse.json({ results: [] });
    }

    console.log(`✅ Found ${filteredClienti.length} clients`);

    // ✅ FIXED N+1: Single query con JOIN per tutte le buste
    const clientIds = filteredClienti.map(c => c.id);
    
    const { data: allBuste, error: busteError } = await supabase
      .from('buste')
      .select('id, readable_id, stato_attuale, data_apertura, updated_at, cliente_id')
      .in('cliente_id', clientIds)
      .is('deleted_at', null)
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
    const results = filteredClienti.map(cliente => ({
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
