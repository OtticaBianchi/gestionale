'use client';

import { RefreshCw, Plus, Package, Search, Mic } from 'lucide-react';
import Link from 'next/link';
import { useBuste } from '@/hooks/useBuste';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';

export default function ButtonsBar() {
  const { mutate: revalidate, isLoading } = useBuste();
  const [userRole, setUserRole] = useState<string | null>(null);

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Check user role
  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        setUserRole(profile?.role || null);
      }
    };

    checkUserRole();
  }, [supabase]);

  const handleRefresh = async () => {
    try {
      toast.loading('Aggiornamento in corso...');
      await revalidate();
      toast.dismiss();
      toast.success('Dati aggiornati con successo');
    } catch (error) {
      toast.dismiss();
      toast.error('Errore durante l\'aggiornamento');
    }
  };

  const showOpsButtons = Boolean(userRole && userRole !== 'operatore');

  return (
    <div className="border-b border-slate-200/70 bg-white/80 px-6 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {/* Nuova Busta button - only for non-operators */}
        {showOpsButtons && (
          <Link
            href="/dashboard/buste/new"
            className="flex items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 py-2 text-sm text-[var(--paper)] transition-colors hover:bg-black"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nuova Busta</span>
          </Link>
        )}

        {/* Ordina button */}
        {showOpsButtons && (
          <Link
            href="/modules/operations"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700 transition-colors hover:border-slate-300 hover:bg-white"
          >
            <Package className="h-3.5 w-3.5" />
            <span>Ordini</span>
          </Link>
        )}

        {/* Ricerca button */}
        {showOpsButtons && (
          <Link
            href="/dashboard/ricerca-avanzata"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700 transition-colors hover:border-slate-300 hover:bg-white"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Ricerca</span>
          </Link>
        )}

        {/* Note Vocali button */}
        {showOpsButtons && (
          <Link
            href="/dashboard/voice-notes"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700 transition-colors hover:border-slate-300 hover:bg-white"
          >
            <Mic className="h-3.5 w-3.5" />
            <span>Note Vocali</span>
          </Link>
        )}

        {/* Aggiorna button */}
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700 transition-colors hover:border-slate-300 hover:bg-white disabled:opacity-50"
          title="Aggiorna dati"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Aggiorna</span>
        </button>
      </div>
    </div>
  );
}
