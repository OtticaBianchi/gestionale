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

export async function GET(request: NextRequest) {
  const auth = await getAdminContext();
  if (auth.response) return auth.response;

  const { searchParams } = new URL(request.url);
  const summary = searchParams.get('summary');
  const statusFilterRaw = searchParams.get('status');
  const search = searchParams.get('search') || '';
  const procedureId = searchParams.get('procedure_id');

  const statusFilterNormalized = statusFilterRaw ? statusFilterRaw.toLowerCase() : null;
  const typedStatus = allowedStatuses.includes(statusFilterNormalized as SuggestionStatus)
    ? (statusFilterNormalized as SuggestionStatus)
    : null;
  const shouldFilterOpen = statusFilterNormalized === 'open';

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (summary === 'count') {
    let countQuery = adminClient
      .from('procedure_suggestions')
      .select('id', { count: 'exact', head: true });

    if (shouldFilterOpen) {
      countQuery = countQuery.or('status.in.("pending","in_review"),status.is.null');
    } else if (typedStatus) {
      countQuery = countQuery.eq('status', typedStatus);
    }

    const { count, error } = await countQuery;

    if (error) {
      console.error('Error counting procedure suggestions:', error);
      return NextResponse.json({ error: 'Errore nel conteggio delle proposte' }, { status: 500 });
    }

    return NextResponse.json({ count: count ?? 0 });
  }

  let query = adminClient
    .from('procedure_suggestions')
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
    .order('created_at', { ascending: false });

  if (shouldFilterOpen) {
    query = query.or('status.in.("pending","in_review"),status.is.null');
  } else if (typedStatus) {
    query = query.eq('status', typedStatus);
  }

  if (procedureId) {
    query = query.eq('procedure_id', procedureId);
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching procedure suggestions:', error);
    return NextResponse.json({ error: 'Errore nel recupero delle proposte' }, { status: 500 });
  }

  const suggestions = (data ?? []).map(mapSuggestion);

  return NextResponse.json({ suggestions });
}
