export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const allowedStatuses = ['pending', 'in_review', 'accepted', 'rejected'] as const;
type SuggestionStatus = typeof allowedStatuses[number];

type AuthContext = {
  userId: string;
  role: string | null;
};

async function getAdminContext(): Promise<{ response?: NextResponse; context?: AuthContext }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (!user || error) {
    return { response: NextResponse.json({ error: 'Non autorizzato' }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return { response: NextResponse.json({ error: 'Profilo non trovato' }, { status: 404 }) };
  }

  if (profile.role !== 'admin') {
    return { response: NextResponse.json({ error: 'Solo gli amministratori possono accedere' }, { status: 403 }) };
  }

  return { context: { userId: user.id, role: profile.role ?? null } };
}

function normalizeStatus(status: string | null): SuggestionStatus {
  const normalized = (status || '').toLowerCase();
  return allowedStatuses.includes(normalized as SuggestionStatus)
    ? (normalized as SuggestionStatus)
    : 'pending';
}

function mapSuggestion(row: any) {
  return {
    ...row,
    status: normalizeStatus(row?.status ?? null)
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getAdminContext();
  if (auth.response) return auth.response;

  const { id: suggestionId } = await params;
  if (!suggestionId) {
    return NextResponse.json({ error: 'ID proposta mancante' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Payload non valido' }, { status: 400 });
  }

  const { status, admin_notes } = body as {
    status?: string;
    admin_notes?: string | null;
  };

  const updates: Record<string, any> = {};
  let normalizedStatus: SuggestionStatus | null = null;

  if (typeof status === 'string') {
    const lower = status.toLowerCase();
    if (allowedStatuses.includes(lower as SuggestionStatus)) {
      normalizedStatus = lower as SuggestionStatus;
      updates.status = normalizedStatus;
      if (normalizedStatus === 'pending') {
        updates.handled_by = null;
        updates.handled_at = null;
      } else if (normalizedStatus === 'in_review') {
        updates.handled_by = auth.context!.userId;
        updates.handled_at = null;
      } else {
        updates.handled_by = auth.context!.userId;
        updates.handled_at = new Date().toISOString();
      }
    } else {
      return NextResponse.json({ error: 'Status non valido' }, { status: 400 });
    }
  }

  if ('admin_notes' in body) {
    if (typeof admin_notes === 'string' || admin_notes === null) {
      updates.admin_notes = admin_notes;
    } else {
      return NextResponse.json({ error: 'admin_notes deve essere una stringa o null' }, { status: 400 });
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await adminClient
    .from('procedure_suggestions')
    .update(updates)
    .eq('id', suggestionId)
    .select(`
      id,
      procedure_id,
      title,
      description,
      suggested_by,
      created_at,
      status,
      admin_notes,
      handled_by,
      handled_at,
      procedure:procedures (
        id,
        title,
        slug
      ),
      suggested_by_profile:profiles!procedure_suggestions_suggested_by_fkey (
        id,
        full_name
      ),
      handler:profiles!procedure_suggestions_handled_by_fkey (
        id,
        full_name
      )
    `)
    .single();

  if (error) {
    console.error('Error updating procedure suggestion:', error);
    return NextResponse.json({ error: 'Errore durante l\'aggiornamento' }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Proposta non trovata' }, { status: 404 });
  }

  return NextResponse.json({ suggestion: mapSuggestion(data) });
}
