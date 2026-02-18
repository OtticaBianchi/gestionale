import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const supabaseAdmin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase service role env vars are not configured.');
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
})();

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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || (profile.role !== 'admin' && profile.role !== 'manager')) {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 });
    }

    const existing = await supabaseAdmin
      .from('tipi_montaggio')
      .select('id, created_at, nome')
      .eq('nome', 'Nessuna Lavorazione')
      .maybeSingle();

    if (existing.error) {
      console.error('Error fetching Nessuna Lavorazione tipo:', existing.error);
      return NextResponse.json(
        { error: existing.error.message ?? 'Errore lettura tipi montaggio' },
        { status: 500 }
      );
    }

    if (existing.data) {
      return NextResponse.json({ tipo: existing.data });
    }

    const created = await supabaseAdmin
      .from('tipi_montaggio')
      .insert({ nome: 'Nessuna Lavorazione' })
      .select('id, created_at, nome')
      .single();

    if (created.error || !created.data) {
      console.error('Error creating Nessuna Lavorazione tipo (admin):', created.error);
      return NextResponse.json(
        { error: created.error?.message ?? 'Impossibile creare tipo montaggio' },
        { status: 500 }
      );
    }

    return NextResponse.json({ tipo: created.data });
  } catch (error: any) {
    console.error('Unexpected error ensuring Nessuna Lavorazione tipo:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Errore imprevisto' },
      { status: 500 }
    );
  }
}
