import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

const TABLE_DELETE_ORDER = [
  'ordini_materiali',
  'info_pagamenti',
  'lavorazioni',
  'buste',
  'clienti'
] as const;

type TableName = typeof TABLE_DELETE_ORDER[number];

export async function POST() {
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

    const counts: Record<string, number> = {};

    for (const table of TABLE_DELETE_ORDER) {
      const { count, error } = await serviceClient
        .from(table)
        .delete({ count: 'exact' })
        .not('deleted_at', 'is', null);

      if (error) {
        console.error('CESTINO_EMPTY_ERROR', { table, error });
        return NextResponse.json({ error: `Errore durante lo svuotamento (${table})` }, { status: 500 });
      }

      counts[table] = count ?? 0;
    }

    await serviceClient.from('audit_log').insert({
      table_name: 'cestino_empty',
      record_id: randomUUID(),
      action: 'DELETE',
      user_id: user.id,
      user_role: profile?.role ?? null,
      changed_fields: counts,
      metadata: {
        source: 'cestino_empty',
        executed_at: new Date().toISOString()
      }
    });

    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

    return NextResponse.json({
      success: true,
      message: 'Cestino svuotato con successo',
      counts,
      total
    });
  } catch (error) {
    console.error('CESTINO_EMPTY_UNEXPECTED_ERROR', error);
    return NextResponse.json({ error: 'Errore imprevisto' }, { status: 500 });
  }
}
