import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error('Supabase service role environment variables are not configured');
}

const adminClient = createClient(url, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
});

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { bustaId } = await request.json();

    if (!bustaId || typeof bustaId !== 'string') {
      return NextResponse.json({ error: 'Missing bustaId' }, { status: 400 });
    }

    const now = new Date().toISOString();

    const { error } = await adminClient
      .from('info_pagamenti')
      .upsert({
        busta_id: bustaId,
        prezzo_finale: 0,
        importo_acconto: 0,
        ha_acconto: false,
        modalita_saldo: 'saldo_unico',
        note_pagamento: 'NESSUN_INCASSO',
        is_saldato: true,
        data_saldo: now,
        updated_at: now,
        updated_by: user.id,
      }, { onConflict: 'busta_id' });

    if (error) {
      console.error('❌ Supabase upsert error (no-payment):', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ POST /api/buste/no-payment error:', error);
    return NextResponse.json({ error: error.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const bustaId = searchParams.get('bustaId');

    if (!bustaId) {
      return NextResponse.json({ error: 'Missing bustaId' }, { status: 400 });
    }

    const { error } = await adminClient
      .from('info_pagamenti')
      .update({
        note_pagamento: null,
        prezzo_finale: null,
        importo_acconto: null,
        ha_acconto: false,
        is_saldato: false,
        data_saldo: null,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('busta_id', bustaId);

    if (error) {
      console.error('❌ Supabase update error (clear no-payment):', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ DELETE /api/buste/no-payment error:', error);
    return NextResponse.json({ error: error.message || 'Unexpected error' }, { status: 500 });
  }
}
