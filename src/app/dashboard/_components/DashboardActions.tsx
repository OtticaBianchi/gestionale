'use client';

import { RefreshCw, Filter, Plus } from 'lucide-react';
import Link from 'next/link';
import { useBuste } from '@/hooks/useBuste';
import { toast } from 'sonner';

interface DashboardActionsProps {
  totalBuste: number;
}

export default function DashboardActions({ totalBuste }: DashboardActionsProps) {
  const { mutate: revalidate, isLoading } = useBuste();

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
        <span>Aggiorna</span>
      </button>
      
      {/* Filtri - LINK ALLA TUA PAGINA FILTRI - ROSSO */}
      <Link
        href="/dashboard/filtri-ordini"
        className="flex items-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
      >
        <Filter className="h-4 w-4" />
        <span>Ordini</span>
      </Link>
      
      {/* Nuova busta */}
      <Link
        href="/dashboard/buste/new"
        className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
      >
        <Plus className="h-4 w-4" />
        <span>Nuova Busta</span>
      </Link>
    </div>
  );
}