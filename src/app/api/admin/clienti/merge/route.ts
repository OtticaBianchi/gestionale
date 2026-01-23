export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { logAuditChange, logDelete, logUpdate } from '@/lib/audit/auditLog';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type ClienteRecord = {
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

type ClienteMergeUpdate = {
  telefono?: string | null;
  email?: string | null;
  genere?: string | null;
  data_nascita?: string | null;
  note_cliente?: string | null;
};

const normalizeText = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase();

const normalizePhoneDigits = (value: string | null | undefined) =>
  (value ?? '').replace(/[^\d]/g, '');

const isEmptyValue = (value: string | null | undefined) =>
  !value || value.trim().length === 0;

const isEmptyRecord = (client: ClienteRecord) =>
  isEmptyValue(client.telefono) &&
  isEmptyValue(client.email) &&
  isEmptyValue(client.genere) &&
  !client.data_nascita &&
  isEmptyValue(client.note_cliente);

const hasExtraData = (client: ClienteRecord) => !isEmptyRecord(client);

const mergeNotes = (winnerNote: string | null, loserNote: string | null) => {
  const cleanWinner = winnerNote?.trim();
  const cleanLoser = loserNote?.trim();
  if (!cleanWinner && cleanLoser) return cleanLoser;
  if (!cleanLoser || cleanLoser.length === 0) return cleanWinner ?? null;
  if (!cleanWinner || cleanWinner.length === 0) return cleanLoser;
  if (cleanWinner === cleanLoser) return cleanWinner;

  const mergedAt = new Date().toISOString().split('T')[0];
  return `${cleanWinner}\n\n[Note da merge ${mergedAt}]\n${cleanLoser}`;
};

export async function POST(request: NextRequest) {
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
      return NextResponse.json({ error: 'Solo gli admin possono eseguire merge' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Payload non valido' }, { status: 400 });
    }

    const {
      winner_id: winnerId,
      loser_id: loserId,
      mode = 'manual',
      reason = 'Merge duplicati clienti',
      force = false
    } = body as {
      winner_id: string;
      loser_id: string;
      mode?: 'manual' | 'auto';
      reason?: string;
      force?: boolean;
    };

    if (!winnerId || !loserId || winnerId === loserId) {
      return NextResponse.json({ error: 'Selezione merge non valida' }, { status: 400 });
    }

    const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { data: clienti, error: clientiError } = await admin
      .from('clienti')
      .select(
        'id, nome, cognome, telefono, email, genere, data_nascita, note_cliente, created_at, updated_at, deleted_at'
      )
      .in('id', [winnerId, loserId]);

    if (clientiError || !clienti || clienti.length < 2) {
      return NextResponse.json({ error: 'Clienti non trovati' }, { status: 404 });
    }

    const winner = clienti.find((item) => item.id === winnerId) as ClienteRecord | undefined;
    const loser = clienti.find((item) => item.id === loserId) as ClienteRecord | undefined;

    if (!winner || !loser) {
      return NextResponse.json({ error: 'Clienti non trovati' }, { status: 404 });
    }

    if (winner.deleted_at || loser.deleted_at) {
      return NextResponse.json({ error: 'Impossibile unire clienti eliminati' }, { status: 400 });
    }

    const winnerNome = normalizeText(winner.nome);
    const winnerCognome = normalizeText(winner.cognome);
    const loserNome = normalizeText(loser.nome);
    const loserCognome = normalizeText(loser.cognome);

    if (!winnerNome || !winnerCognome || winnerNome !== loserNome || winnerCognome !== loserCognome) {
      return NextResponse.json({ error: 'Nome e cognome non coincidono' }, { status: 409 });
    }

    const { count: loserBusteCount, error: busteError } = await admin
      .from('buste')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', loserId)
      .is('deleted_at', null);

    if (busteError) {
      return NextResponse.json({ error: 'Errore durante la verifica buste' }, { status: 500 });
    }

    if ((loserBusteCount ?? 0) > 0) {
      return NextResponse.json(
        {
          error: 'Il cliente da eliminare ha buste collegate e non può essere rimosso',
          code: 'LOSER_HAS_BUSTE'
        },
        { status: 409 }
      );
    }

    if (mode === 'auto') {
      if (!isEmptyRecord(loser) || !hasExtraData(winner)) {
        return NextResponse.json({ error: 'Merge automatico non consentito' }, { status: 409 });
      }
    }

    const conflicts: string[] = [];
    const winnerPhone = normalizePhoneDigits(winner.telefono);
    const loserPhone = normalizePhoneDigits(loser.telefono);
    if (winnerPhone && loserPhone && winnerPhone !== loserPhone) {
      conflicts.push('telefono');
    }

    const winnerEmail = normalizeText(winner.email);
    const loserEmail = normalizeText(loser.email);
    if (winnerEmail && loserEmail && winnerEmail !== loserEmail) {
      conflicts.push('email');
    }

    const winnerGenere = normalizeText(winner.genere);
    const loserGenere = normalizeText(loser.genere);
    if (winnerGenere && loserGenere && winnerGenere !== loserGenere) {
      conflicts.push('genere');
    }

    if (winner.data_nascita && loser.data_nascita && winner.data_nascita !== loser.data_nascita) {
      conflicts.push('data_nascita');
    }

    if (conflicts.length > 0 && !force) {
      return NextResponse.json(
        {
          error: 'Conflitti sui dati anagrafici',
          conflicts
        },
        { status: 409 }
      );
    }

    const mergedData: ClienteMergeUpdate = {};
    if (!winner.telefono && loser.telefono) mergedData.telefono = loser.telefono;
    if (!winner.email && loser.email) mergedData.email = loser.email;
    if (!winner.genere && loser.genere) mergedData.genere = loser.genere;
    if (!winner.data_nascita && loser.data_nascita) mergedData.data_nascita = loser.data_nascita;

    const mergedNote = mergeNotes(winner.note_cliente, loser.note_cliente);
    if (mergedNote && mergedNote !== winner.note_cliente) {
      mergedData.note_cliente = mergedNote;
    }

    const now = new Date().toISOString();

    if (Object.keys(mergedData).length > 0) {
      const { error: updateWinnerError } = await admin
        .from('clienti')
        .update({
          ...mergedData,
          updated_at: now,
          updated_by: user.id
        })
        .eq('id', winnerId);

      if (updateWinnerError) {
        return NextResponse.json({ error: 'Errore durante l\'aggiornamento del cliente' }, { status: 500 });
      }
    }

    const { error: updateErrors } = await admin
      .from('error_tracking')
      .update({ cliente_id: winnerId, updated_at: now })
      .eq('cliente_id', loserId);

    if (updateErrors) {
      return NextResponse.json({ error: 'Errore durante l\'aggiornamento errori' }, { status: 500 });
    }

    const { error: updateVoiceNotes } = await admin
      .from('voice_notes')
      .update({ cliente_id: winnerId, updated_at: now })
      .eq('cliente_id', loserId);

    if (updateVoiceNotes) {
      return NextResponse.json({ error: 'Errore durante l\'aggiornamento voice notes' }, { status: 500 });
    }

    const { error: deleteError } = await admin
      .from('clienti')
      .update({
        deleted_at: now,
        deleted_by: user.id,
        updated_at: now,
        updated_by: user.id
      })
      .eq('id', loserId)
      .is('deleted_at', null);

    if (deleteError) {
      return NextResponse.json({ error: 'Errore durante la rimozione del cliente duplicato' }, { status: 500 });
    }

    if (Object.keys(mergedData).length > 0) {
      await logUpdate('clienti', winnerId, user.id, winner, { ...winner, ...mergedData }, reason, {
        merged_from: loserId,
        mode
      }, profile.role);
    } else {
      await logAuditChange({
        tableName: 'clienti',
        recordId: winnerId,
        action: 'UPDATE',
        userId: user.id,
        userRole: profile.role,
        changedFields: {
          _merge: {
            old: null,
            new: { merged_from: loserId }
          }
        },
        reason,
        metadata: { mode }
      });
    }

    await logDelete('clienti', loserId, user.id, loser, reason, {
      merged_into: winnerId,
      mode,
      conflicts: conflicts.length ? conflicts : null
    }, profile.role);

    return NextResponse.json({
      success: true,
      winner_id: winnerId,
      loser_id: loserId,
      merged_fields: Object.keys(mergedData),
      conflicts: conflicts.length ? conflicts : null
    });
  } catch (error) {
    console.error('POST /api/admin/clienti/merge error:', error);
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 });
  }
}
