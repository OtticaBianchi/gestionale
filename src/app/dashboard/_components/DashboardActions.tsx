'use client';

import { RefreshCw, Filter, Plus, Mic, Search } from 'lucide-react';
import Link from 'next/link';
import { useBuste } from '@/hooks/useBuste';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { useUser } from '@/context/UserContext';

interface DashboardActionsProps {
  totalBuste: number;
}

export default function DashboardActions({ totalBuste }: DashboardActionsProps) {
  const { mutate: revalidate, isLoading } = useBuste();
  const [voiceNotesCount, setVoiceNotesCount] = useState(0);
  const { profile } = useUser();

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

      {/* Filtri - LINK ALLA TUA PAGINA FILTRI - ROSSO */}
      <Link
        href="/dashboard/filtri-ordini"
        className="flex items-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
      >
        <Filter className="h-4 w-4" />
        <span>Ordini</span>
      </Link>
      
      {/* Nuova busta - nascosto per operatori */}
      {profile?.role !== 'operatore' && (
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