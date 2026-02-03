'use client';

import { RefreshCw, Plus } from 'lucide-react';
import Link from 'next/link';
import { useBuste } from '@/hooks/useBuste';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';

interface DashboardActionsProps {
  totalBuste: number;
}

export default function DashboardActions({ totalBuste }: DashboardActionsProps) {
  const { mutate: revalidate, isLoading } = useBuste();
  const [userRole, setUserRole] = useState<string | null>(null);
  
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ===== CHECK USER ROLE =====
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
    <div className="flex items-center space-x-3">
      {/* Refresh button */}
      <button
        onClick={handleRefresh}
        disabled={isLoading}
        className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
        title="Aggiorna dati"
      >
        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        <span className="hidden sm:inline">Aggiorna</span>
      </button>

      {/* ===== NUOVA BUSTA - QUICK ACCESS ===== */}
      {userRole && userRole !== 'operatore' && (
        <Link
          href="/dashboard/buste/new"
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nuova Busta</span>
        </Link>
      )}
    </div>
  );
}
