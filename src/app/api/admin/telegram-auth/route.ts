export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// GET: List unauthorized users
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

  const summary = request.nextUrl.searchParams.get('summary');

  // Ensure admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const role = profile?.role;
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';

  if (!summary && !isAdmin) {
    return NextResponse.json({ error: 'Solo gli amministratori possono accedere' }, { status: 403 });
  }

  if (summary && !(isAdmin || isManager)) {
    return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    if (summary === 'count') {
      const { count, error } = await adminClient
        .from('telegram_auth_requests')
        .select('id', { count: 'exact', head: true })
        .eq('authorized', false);

      if (error) throw error;

      return NextResponse.json({ count: count ?? 0 });
    }

    // Get unauthorized users
    const { data: unauthorizedUsers, error } = await adminClient
      .from('telegram_auth_requests')
      .select('*')
      .eq('authorized', false)
      .order('last_seen_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ unauthorizedUsers: unauthorizedUsers || [] });
  } catch (error: any) {
    console.error('Telegram auth list error:', error);
    return NextResponse.json({ error: 'Errore caricamento richieste', details: error.message }, { status: 500 });
  }
}

// POST: Authorize a user
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

  // Ensure admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Solo gli amministratori possono accedere' }, { status: 403 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { telegramUserId, profileId } = await request.json();

    if (!telegramUserId || !profileId) {
      return NextResponse.json({ error: 'telegramUserId e profileId richiesti' }, { status: 400 });
    }

    // Update profile with telegram info
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({
        telegram_user_id: telegramUserId,
        telegram_bot_access: true
      })
      .eq('id', profileId);

    if (updateError) throw updateError;

    const { data: profileRow, error: profileFetchError } = await adminClient
      .from('profiles')
      .select('full_name')
      .eq('id', profileId)
      .single();

    if (profileFetchError) throw profileFetchError;

    const label = profileRow?.full_name || telegramUserId;

    const { error: allowListError } = await adminClient
      .from('telegram_allowed_users')
      .upsert(
        {
          telegram_user_id: telegramUserId,
          profile_id: profileId,
          label,
          can_use_bot: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'telegram_user_id' }
      );

    if (allowListError) throw allowListError;

    // Mark as authorized in auth requests
    await adminClient
      .from('telegram_auth_requests')
      .update({ authorized: true })
      .eq('telegram_user_id', telegramUserId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Telegram auth error:', error);
    return NextResponse.json({ error: 'Errore autorizzazione', details: error.message }, { status: 500 });
  }
}

// DELETE: Remove an unauthorized request
export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Solo gli amministratori possono accedere' }, { status: 403 });
  }

  let payload: { telegramUserId?: string } = {};
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON richiesto' }, { status: 400 });
  }

  const telegramUserId = payload.telegramUserId;
  if (!telegramUserId) {
    return NextResponse.json({ error: 'telegramUserId richiesto' }, { status: 400 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { error } = await adminClient
      .from('telegram_auth_requests')
      .delete()
      .eq('telegram_user_id', telegramUserId)
      .eq('authorized', false);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Telegram auth delete error:', error);
    return NextResponse.json({ error: 'Errore eliminazione richiesta', details: error.message }, { status: 500 });
  }
}
