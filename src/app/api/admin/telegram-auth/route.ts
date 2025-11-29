export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

// GET: List unauthorized users and authorised entries
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();

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

    const { data: allowList, error: allowListError } = await adminClient
      .from('telegram_allowed_users')
      .select(`
        telegram_user_id,
        profile_id,
        label,
        can_use_bot,
        updated_at,
        profiles (
          id,
          full_name,
          role,
          telegram_user_id,
          telegram_bot_access,
          updated_at
        )
      `)
      .order('label', { ascending: true });

    if (allowListError) throw allowListError;

    const authorizedMap = new Map<string, any>();
    const revoked: any[] = [];

    (allowList || []).forEach((entry: any) => {
      const telegramId = entry.telegram_user_id;
      const isActive = entry.can_use_bot !== false;

      if (isActive && telegramId) {
        authorizedMap.set(telegramId, {
          ...entry,
          can_use_bot: true
        });
      } else if (!isActive && telegramId) {
        revoked.push({
          ...entry,
          can_use_bot: false
        });
      }
    });

    const { data: activeProfiles, error: activeProfilesError } = await adminClient
      .from('profiles')
      .select('id, full_name, role, telegram_user_id, telegram_bot_access, updated_at')
      .eq('telegram_bot_access', true)
      .not('telegram_user_id', 'is', null);

    if (activeProfilesError) throw activeProfilesError;

    (activeProfiles || []).forEach((profile: any) => {
      const telegramId = profile.telegram_user_id;
      if (!telegramId) return;

      const existing = authorizedMap.get(telegramId);
      if (existing) {
        authorizedMap.set(telegramId, {
          ...existing,
          profile_id: existing.profile_id || profile.id,
          label: existing.label || profile.full_name || telegramId,
          profiles: existing.profiles || profile,
          updated_at: existing.updated_at || profile.updated_at,
          can_use_bot: true
        });
      } else {
        authorizedMap.set(telegramId, {
          telegram_user_id: telegramId,
          profile_id: profile.id,
          label: profile.full_name || telegramId,
          can_use_bot: true,
          updated_at: profile.updated_at,
          profiles: profile
        });
      }
    });

    const authorised = Array.from(authorizedMap.values());

    return NextResponse.json({
      unauthorizedUsers: unauthorizedUsers || [],
      authorizedUsers: authorised || [],
      revokedUsers: revoked || []
    });
  } catch (error: any) {
    console.error('Telegram auth list error:', error);
    return NextResponse.json({ error: 'Errore caricamento richieste', details: error.message }, { status: 500 });
  }
}

// POST: Authorize a user
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();

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

    const { data: pendingRequest } = await adminClient
      .from('telegram_auth_requests')
      .select('*')
      .eq('telegram_user_id', telegramUserId)
      .eq('authorized', false)
      .maybeSingle();

    if (!pendingRequest) {
      return NextResponse.json({ error: 'Richiesta non trovata o già gestita' }, { status: 404 });
    }

    // Update profile with telegram info
    const { data: profileRow, error: profileFetchError } = await adminClient
      .from('profiles')
      .select('id, full_name, telegram_user_id, telegram_bot_access')
      .eq('id', profileId)
      .maybeSingle();

    if (profileFetchError) throw profileFetchError;

    if (!profileRow) {
      return NextResponse.json({ error: 'Profilo non trovato' }, { status: 404 });
    }

    if (profileRow.telegram_user_id && profileRow.telegram_user_id !== telegramUserId) {
      return NextResponse.json({ error: 'Il profilo selezionato è già collegato a un altro account Telegram' }, { status: 409 });
    }

    const { data: existingAllow } = await adminClient
      .from('telegram_allowed_users')
      .select('telegram_user_id, can_use_bot')
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle();

    if (existingAllow?.can_use_bot) {
      return NextResponse.json({ error: 'Questo account Telegram è già autorizzato' }, { status: 409 });
    }

    const { error: updateError } = await adminClient
      .from('profiles')
      .update({
        telegram_user_id: telegramUserId,
        telegram_bot_access: true
      })
      .eq('id', profileId);

    if (updateError) throw updateError;

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

// PATCH: Revoke access
export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient();

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
    const { data: allowEntry, error: allowError } = await adminClient
      .from('telegram_allowed_users')
      .select('profile_id, label, can_use_bot')
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle();

    if (allowError) throw allowError;

    if (!allowEntry || !allowEntry.can_use_bot) {
      return NextResponse.json({ error: 'Account Telegram non autorizzato o già revocato' }, { status: 404 });
    }

    if (allowEntry.profile_id) {
      const { error: profileResetError } = await adminClient
        .from('profiles')
        .update({
          telegram_user_id: null,
          telegram_bot_access: false
        })
        .eq('id', allowEntry.profile_id);

      if (profileResetError) throw profileResetError;
    }

    const { error: revokeError } = await adminClient
      .from('telegram_allowed_users')
      .upsert({
        telegram_user_id: telegramUserId,
        profile_id: allowEntry.profile_id,
        label: allowEntry.label || telegramUserId,
        can_use_bot: false,
        updated_at: new Date().toISOString()
      }, { onConflict: 'telegram_user_id' });

    if (revokeError) throw revokeError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Telegram revoke error:', error);
    return NextResponse.json({ error: 'Errore revoca accesso', details: error.message }, { status: 500 });
  }
}

// DELETE: Remove an unauthorized request
export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient();

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

  let payload: { telegramUserId?: string | null, requestId?: number } = {};
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON richiesto' }, { status: 400 });
  }

  const telegramUserId = payload.telegramUserId ?? undefined;
  const requestId = payload.requestId;

  if (!telegramUserId && !requestId) {
    return NextResponse.json({ error: 'telegramUserId o requestId richiesti' }, { status: 400 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const filter = telegramUserId ? { telegram_user_id: telegramUserId } : { id: requestId };

    const { data: pendingRequest } = await adminClient
      .from('telegram_auth_requests')
      .select('telegram_username, first_name, last_name')
      .match(filter)
      .eq('authorized', false)
      .maybeSingle();

    if (!pendingRequest) {
      return NextResponse.json({ error: 'Richiesta non trovata o già gestita' }, { status: 404 });
    }

    if (telegramUserId) {
      const label =
        pendingRequest.telegram_username ||
        [pendingRequest.first_name, pendingRequest.last_name].filter(Boolean).join(' ').trim() ||
        telegramUserId;

      const { error: historyError } = await adminClient
        .from('telegram_allowed_users')
        .upsert({
          telegram_user_id: telegramUserId,
          profile_id: null,
          label,
          can_use_bot: false,
          updated_at: new Date().toISOString()
        }, { onConflict: 'telegram_user_id' });

      if (historyError) {
        console.error('Telegram auth history upsert error:', historyError);
      }
    }

    const { error } = await adminClient
      .from('telegram_auth_requests')
      .delete()
      .match(filter)
      .eq('authorized', false);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Telegram auth delete error:', error);
    return NextResponse.json({ error: 'Errore eliminazione richiesta', details: error.message }, { status: 500 });
  }
}
