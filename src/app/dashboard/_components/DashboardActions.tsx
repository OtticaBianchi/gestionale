'use client';

import { RefreshCw, Filter, Plus, Mic, Search } from 'lucide-react';
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
  const [voiceNotesCount, setVoiceNotesCount] = useState(0);
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

  const fetchVoiceNotesCount = async () => {
    try {
      const response = await fetch('/api/voice-notes');
      if (response.ok) {
        const data = await response.json();
        setVoiceNotesCount(data.notes?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching voice notes count:', error);
    }
  };

  useEffect(() => {
    fetchVoiceNotesCount();
    // Refresh count every 30 seconds
    const interval = setInterval(fetchVoiceNotesCount, 30000);
    return () => clearInterval(interval);
  }, []);

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
        <span>Aggiorna</span>
      </button>
      
      {/* Note vocali */}
      <Link
        href="/dashboard/voice-notes"
        className="relative flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
      >
        <Mic className="h-4 w-4" />
        <span>Note Vocali</span>
        {voiceNotesCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
            {voiceNotesCount > 99 ? '99+' : voiceNotesCount}
          </span>
        )}
      </Link>

      {/* Ricerca Avanzata */}
      <Link
        href="/dashboard/ricerca-avanzata"
        className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
      >
        <Search className="h-4 w-4" />
        <span>Ricerca Avanzata</span>
      </Link>

      {/* ===== ORDINI - NASCOSTO PER OPERATORI ===== */}
      {userRole !== 'operatore' && (
        <Link
          href="/dashboard/filtri-ordini"
          className="flex items-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          <Filter className="h-4 w-4" />
          <span>Ordini</span>
        </Link>
      )}
      
      {/* ===== NUOVA BUSTA - NASCOSTO PER OPERATORI ===== */}
      {userRole !== 'operatore' && (
        <Link
          href="/dashboard/buste/new"
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Nuova Busta</span>
        </Link>
      )}
    </div>
  );
}