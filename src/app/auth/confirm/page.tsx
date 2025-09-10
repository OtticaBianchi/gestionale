'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import { Loader2 } from 'lucide-react';

const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AuthConfirmPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        // Support both hash token (recovery/invite) and code param (magic link)
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
        const qs = new URLSearchParams(window.location.search);

        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        const code = qs.get('code');

        if (code) {
          // Magic link / OAuth code flow
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (access_token && refresh_token) {
          // Invite / recovery hash token flow
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;
        }

        // Ensure profile exists and role matches invitation metadata
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const invitedRole = (user.user_metadata as any)?.role || 'operatore';
          const invitedName = (user.user_metadata as any)?.full_name || user.email?.split('@')[0] || 'Utente';
          const { data: profile, error: profErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (profErr && (profErr as any).code === 'PGRST116') {
            await supabase
              .from('profiles')
              .insert({ id: user.id, full_name: invitedName, role: invitedRole })
              .select()
              .single();
          } else if (profile && profile.role !== invitedRole && ['admin','manager','operatore'].includes(invitedRole)) {
            await supabase
              .from('profiles')
              .update({ role: invitedRole, updated_at: new Date().toISOString() })
              .eq('id', user.id);
          }
        }

        // If this is an invite with password setup requested, send to set-password page
        const goSetPassword = new URLSearchParams(window.location.search).get('set_password') === '1';
        if (goSetPassword) {
          window.location.replace('/auth/set-password');
          return;
        }

        // Otherwise, redirect to dashboard
        window.location.replace('/dashboard');
      } catch (e: any) {
        console.error('Auth confirm error:', e);
        setError(e.message || 'Errore autenticazione');
      }
    };
    run();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-6 rounded-md shadow border border-gray-200 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
        <p className="text-gray-700">Conferma autenticazione in corso...</p>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>
    </div>
  );
}
