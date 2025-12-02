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

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center justify-center gap-2">
        {/* Nuova Busta button - only for non-operators */}
        {userRole !== 'operatore' && (
          <Link
            href="/dashboard/buste/new"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nuova Busta</span>
          </Link>
        )}

        {/* Ordina button */}
        <Link
          href="/modules/operations"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors"
        >
          <Package className="h-3.5 w-3.5" />
          <span>Ordini</span>
        </Link>

        {/* Ricerca button */}
        <Link
          href="/dashboard/ricerca-avanzata"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Ricerca</span>
        </Link>

        {/* Note Vocali button */}
        <Link
          href="/dashboard/voice-notes"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors"
        >
          <Mic className="h-3.5 w-3.5" />
          <span>Note Vocali</span>
        </Link>

        {/* Aggiorna button */}
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
          title="Aggiorna dati"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Aggiorna</span>
        </button>
      </div>
    </div>
  );
}
