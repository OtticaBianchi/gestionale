import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type AuditRow = Database['public']['Tables']['audit_log']['Row'] & {
  profilo?: {
    full_name: string | null;
  } | null;
};

const formatLimit = (value: string | null) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
};

const formatOffset = (value: string | null) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return parsed;
};

const toIsoOrNull = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
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

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Accesso riservato agli amministratori' }, { status: 403 });
    }

    const serviceClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const url = new URL(request.url);
    const params = url.searchParams;

    const limit = formatLimit(params.get('limit'));
    const offset = formatOffset(params.get('offset'));
    const to = offset + limit - 1;

    const tableName = params.get('table');
    const action = params.get('action');
    const recordId = params.get('recordId');
    const userIdFilter = params.get('userId');
    const source = params.get('source');
    const search = params.get('q');
    const fromDate = toIsoOrNull(params.get('from'));
    const toDate = toIsoOrNull(params.get('to'));

    let query = serviceClient
      .from('audit_log')
      .select(
        `
          id,
          table_name,
          record_id,
          action,
          user_id,
          user_role,
          changed_fields,
          reason,
          metadata,
          created_at,
          ip_address,
          user_agent
        `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false });

    if (tableName) {
      query = query.eq('table_name', tableName);
    }

    if (action) {
      query = query.eq('action', action.toUpperCase());
    }

    if (recordId) {
      const recordSearch = recordId.trim();
      if (recordSearch) {
        const filters: string[] = [`record_id.eq.${recordSearch}`];
        filters.push(`metadata->>bustaReadableId.eq.${recordSearch}`);
        query = query.or(filters.join(','));
      }
    }

    if (userIdFilter) {
      query = query.eq('user_id', userIdFilter);
    }

    if (source) {
      query = query.filter('metadata->>source', 'eq', source);
    }

    if (fromDate) {
      query = query.gte('created_at', fromDate);
    }

    if (toDate) {
      query = query.lte('created_at', toDate);
    }

    if (search) {
      const sanitized = search.replace(/,/g, ' ').trim();
      if (sanitized) {
        const likePattern = `*${sanitized.replace(/\s+/g, '%').replace(/\*/g, '').toLowerCase()}*`;
        query = query.or(
          `record_id.ilike.${likePattern},reason.ilike.${likePattern},user_role.ilike.${likePattern},metadata->>cliente.ilike.${likePattern},metadata->>recordLabel.ilike.${likePattern},metadata->>bustaReadableId.ilike.${likePattern}`
        );
      }
    }

    query = query.range(offset, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('AUDIT_LOG_FETCH_ERROR', error);
      return NextResponse.json({ error: 'Errore nel recupero dei log' }, { status: 500 });
    }

    let enriched = (data as AuditRow[]) ?? [];

    if (enriched.length > 0) {
      const userIds = Array.from(
        new Set(enriched.map((row) => row.user_id).filter((value): value is string => Boolean(value)))
      );

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await serviceClient
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        if (profilesError) {
          console.error('AUDIT_LOG_PROFILE_LOOKUP_ERROR', profilesError);
        } else if (profilesData) {
          const profileMap = new Map(profilesData.map((profile) => [profile.id, { full_name: profile.full_name }]));
          enriched = enriched.map((row) => ({
            ...row,
            profilo: row.user_id ? profileMap.get(row.user_id) ?? null : null
          }));
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: enriched,
      count: count ?? 0,
      pagination: {
        limit,
        offset
      }
    });
  } catch (error) {
    console.error('AUDIT_LOGS_UNEXPECTED_ERROR', error);
    return NextResponse.json({ error: 'Errore imprevisto' }, { status: 500 });
  }
}
