import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

export const dynamic = 'force-dynamic';

type CestinoItem = {
  table_name: string | null;
  id: string | null;
  label: string | null;
  cliente_nome: string | null;
  cliente_id: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_by_name: string | null;
  days_remaining: number | null;
  is_expiring_soon: boolean | null;
};

// GET - List all items in cestino
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

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Accesso riservato agli amministratori' }, { status: 403 });
    }

    // Use service client to bypass RLS
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

    // Get query params
    const url = new URL(request.url);
    const tableFilter = url.searchParams.get('table');
    const expiringOnly = url.searchParams.get('expiring') === 'true';

    // Query the cestino_items view
    let query = serviceClient.from('cestino_items').select('*');

    if (tableFilter) {
      query = query.eq('table_name', tableFilter);
    }

    if (expiringOnly) {
      query = query.eq('is_expiring_soon', true);
    }

    const { data: items, error } = await query.order('deleted_at', { ascending: false });

    if (error) {
      console.error('CESTINO_LIST_ERROR', error);
      return NextResponse.json({ error: 'Errore nel recupero degli elementi' }, { status: 500 });
    }

    // Calculate summary stats
    const stats = {
      total: items?.length || 0,
      expiring_soon: items?.filter((i: CestinoItem) => Boolean(i.is_expiring_soon)).length || 0,
      by_table: {} as Record<string, number>
    };

    items?.forEach((item: CestinoItem) => {
      const tableKey = item.table_name ?? 'unknown';
      stats.by_table[tableKey] = (stats.by_table[tableKey] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      data: items || [],
      stats
    });
  } catch (error) {
    console.error('CESTINO_UNEXPECTED_ERROR', error);
    return NextResponse.json({ error: 'Errore imprevisto' }, { status: 500 });
  }
}
