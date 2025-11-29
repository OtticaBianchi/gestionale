import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

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

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('AUDIT_USERS_FETCH_ERROR', error);
      return NextResponse.json({ error: 'Impossibile recuperare gli operatori' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: (data ?? []).filter((item) => Boolean(item.full_name))
    });
  } catch (error) {
    console.error('AUDIT_USERS_UNEXPECTED_ERROR', error);
    return NextResponse.json({ error: 'Errore imprevisto' }, { status: 500 });
  }
}
