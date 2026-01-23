export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type ClientRecord = {
  id: string;
  nome: string | null;
  cognome: string | null;
  telefono: string | null;
  email: string | null;
  genere: string | null;
  data_nascita: string | null;
  note_cliente: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
};

const normalizeText = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase();

const normalizePhoneDigits = (value: string | null | undefined) =>
  (value ?? '').replace(/[^\d]/g, '');

const isEmptyValue = (value: string | null | undefined) =>
  !value || value.trim().length === 0;

const isEmptyRecord = (client: ClientRecord) =>
  isEmptyValue(client.telefono) &&
  isEmptyValue(client.email) &&
  isEmptyValue(client.genere) &&
  !client.data_nascita &&
  isEmptyValue(client.note_cliente);

const hasExtraData = (client: ClientRecord) => !isEmptyRecord(client);

const buildDisplayName = (client: ClientRecord) => {
  const cognome = (client.cognome ?? '').trim();
  const nome = (client.nome ?? '').trim();
  return `${cognome} ${nome}`.trim();
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Solo gli admin possono accedere' }, { status: 403 });
    }

    const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { data: clienti, error: clientiError } = await admin
      .from('clienti')
      .select(
        'id, nome, cognome, telefono, email, genere, data_nascita, note_cliente, created_at, updated_at, deleted_at'
      )
      .is('deleted_at', null);

    if (clientiError) {
      return NextResponse.json({ error: 'Errore durante il caricamento clienti' }, { status: 500 });
    }

    const { data: buste, error: busteError } = await admin
      .from('buste')
      .select('cliente_id')
      .is('deleted_at', null)
      .not('cliente_id', 'is', null);

    if (busteError) {
      return NextResponse.json({ error: 'Errore durante il caricamento buste' }, { status: 500 });
    }

    const { data: errorTracking, error: errorTrackingError } = await admin
      .from('error_tracking')
      .select('cliente_id')
      .not('cliente_id', 'is', null);

    if (errorTrackingError) {
      return NextResponse.json({ error: 'Errore durante il caricamento errori' }, { status: 500 });
    }

    const { data: voiceNotes, error: voiceNotesError } = await admin
      .from('voice_notes')
      .select('cliente_id')
      .not('cliente_id', 'is', null);

    if (voiceNotesError) {
      return NextResponse.json({ error: 'Errore durante il caricamento voice notes' }, { status: 500 });
    }

    const busteCounts = new Map<string, number>();
    buste?.forEach((row) => {
      const id = row.cliente_id;
      if (!id) return;
      busteCounts.set(id, (busteCounts.get(id) ?? 0) + 1);
    });

    const errorTrackingCounts = new Map<string, number>();
    errorTracking?.forEach((row) => {
      const id = row.cliente_id;
      if (!id) return;
      errorTrackingCounts.set(id, (errorTrackingCounts.get(id) ?? 0) + 1);
    });

    const voiceNotesCounts = new Map<string, number>();
    voiceNotes?.forEach((row) => {
      const id = row.cliente_id;
      if (!id) return;
      voiceNotesCounts.set(id, (voiceNotesCounts.get(id) ?? 0) + 1);
    });

    const url = new URL(request.url);
    const mode = url.searchParams.get('mode');
    const includeNameOnly = mode !== 'strict';

    const grouped = new Map<string, ClientRecord[]>();
    (clienti ?? []).forEach((client) => {
      const cognome = normalizeText(client.cognome);
      const nome = normalizeText(client.nome);
      if (!cognome || !nome) return;
      const key = `${cognome}::${nome}`;
      const group = grouped.get(key) ?? [];
      group.push(client as ClientRecord);
      grouped.set(key, group);
    });

    const groups = [];
    let autoMergeGroups = 0;

    for (const [key, group] of grouped.entries()) {
      if (group.length < 2) continue;

      const phoneCounts = new Map<string, number>();
      const emailCounts = new Map<string, number>();

      group.forEach((client) => {
        const phone = normalizePhoneDigits(client.telefono);
        const email = normalizeText(client.email);
        if (phone) {
          phoneCounts.set(phone, (phoneCounts.get(phone) ?? 0) + 1);
        }
        if (email) {
          emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);
        }
      });

      const hasContactMatch =
        Array.from(phoneCounts.values()).some((count) => count > 1) ||
        Array.from(emailCounts.values()).some((count) => count > 1);
      const hasEmpty = group.some((client) => isEmptyRecord(client as ClientRecord));

      if (!hasContactMatch && !hasEmpty && !includeNameOnly) {
        continue;
      }

      const clients = group.map((client) => {
        const busteCount = busteCounts.get(client.id) ?? 0;
        const errorCount = errorTrackingCounts.get(client.id) ?? 0;
        const voiceCount = voiceNotesCounts.get(client.id) ?? 0;
        const score =
          (client.telefono ? 2 : 0) +
          (client.email ? 2 : 0) +
          (client.genere ? 1 : 0) +
          (client.data_nascita ? 1 : 0) +
          (client.note_cliente ? 1 : 0) +
          (busteCount > 0 ? 3 : 0) +
          (errorCount > 0 ? 1 : 0) +
          (voiceCount > 0 ? 1 : 0);

        return {
          ...client,
          display_name: buildDisplayName(client as ClientRecord),
          buste_count: busteCount,
          error_tracking_count: errorCount,
          voice_notes_count: voiceCount,
          has_links: busteCount + errorCount + voiceCount > 0,
          is_empty: isEmptyRecord(client as ClientRecord),
          data_score: score
        };
      });

      let autoMerge = null;
      if (clients.length === 2) {
        const [first, second] = clients;
        const firstEmpty = first.is_empty && !first.has_links;
        const secondEmpty = second.is_empty && !second.has_links;
        if (firstEmpty && hasExtraData(second)) {
          autoMerge = {
            winner_id: second.id,
            loser_id: first.id,
            reason: 'record_vuoto'
          };
        } else if (secondEmpty && hasExtraData(first)) {
          autoMerge = {
            winner_id: first.id,
            loser_id: second.id,
            reason: 'record_vuoto'
          };
        }
      }

      if (autoMerge) {
        autoMergeGroups += 1;
      }

      const reasons = [];
      if (hasContactMatch) reasons.push('contatto_coincidente');
      if (hasEmpty) reasons.push('record_vuoto');
      if (!hasContactMatch && !hasEmpty) reasons.push('nome_coincidente');

      groups.push({
        key,
        display_name: clients[0]?.display_name ?? key,
        reasons,
        auto_merge: autoMerge,
        clients
      });
    }

    groups.sort((a: any, b: any) => a.display_name.localeCompare(b.display_name));

    return NextResponse.json({
      success: true,
      generated_at: new Date().toISOString(),
      stats: {
        groups_total: groups.length,
        auto_merge_groups: autoMergeGroups,
        total_records: groups.reduce((acc: number, group: any) => acc + group.clients.length, 0)
      },
      groups
    });
  } catch (error) {
    console.error('GET /api/admin/clienti/dedup error:', error);
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 });
  }
}
