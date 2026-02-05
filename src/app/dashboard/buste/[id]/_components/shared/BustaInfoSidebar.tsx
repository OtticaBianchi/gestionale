// ===== FILE: buste/[id]/_components/shared/BustaInfoSidebar.tsx =====

'use client';

import { useEffect, useState } from 'react';
import { 
  Clock,
  FileText
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';

// ===== TYPES LOCALI =====
type BustaDettagliata = Database['public']['Tables']['buste']['Row'] & {
  clienti: Database['public']['Tables']['clienti']['Row'] | null;
  profiles: Pick<Database['public']['Tables']['profiles']['Row'], 'full_name'> | null;
  status_history: Array<
    Database['public']['Tables']['status_history']['Row'] & {
      profiles: Pick<Database['public']['Tables']['profiles']['Row'], 'full_name'> | null;
    }
  >;
};

type ControlloQualita = Database['public']['Tables']['buste_controlli_qualita']['Row'] & {
  profiles?: Pick<Database['public']['Tables']['profiles']['Row'], 'full_name'> | null;
};

// Props del componente
interface BustaInfoSidebarProps {
  busta: BustaDettagliata;
}

export default function BustaInfoSidebar({ busta }: BustaInfoSidebarProps) {
  const [controlliQualita, setControlliQualita] = useState<ControlloQualita[]>([]);
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  // ===== UTILITY FUNCTIONS =====
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateDaysOpen = (dataApertura: string) => {
    const openDate = new Date(dataApertura);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - openDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatoColore = (stato: string) => {
    const colors: { [key: string]: string } = {
      'nuove': 'bg-blue-500',
      'materiali_ordinati': 'bg-orange-500',
      'materiali_arrivati': 'bg-lime-500',
      'in_lavorazione': 'bg-purple-500',
      'pronto_ritiro': 'bg-green-500',
      'consegnato_pagato': 'bg-gray-500'
    };
    return colors[stato] || 'bg-gray-400';
  };

  useEffect(() => {
    const loadQcHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('buste_controlli_qualita')
          .select('id, busta_id, cycle_index, completed_by, completed_at, created_at, profiles:completed_by(full_name)')
          .eq('busta_id', busta.id)
          .order('cycle_index', { ascending: false });

        if (error) {
          console.error('❌ Errore caricamento storico controlli qualità:', error);
          setControlliQualita([]);
          return;
        }

        setControlliQualita((data || []) as ControlloQualita[]);
      } catch (err) {
        console.error('❌ Errore caricamento storico controlli qualità:', err);
        setControlliQualita([]);
      }
    };

    loadQcHistory();
  }, [busta.id, busta.controllo_completato_at]);

  const timelineEntries = [
    ...busta.status_history.map((entry) => ({
      type: 'status' as const,
      id: entry.id,
      date: entry.data_ingresso,
      label: entry.stato,
      color: getStatoColore(entry.stato),
      user: entry.profiles?.full_name || null,
      note: entry.note_stato || null
    })),
    ...controlliQualita.map((entry) => ({
      type: 'qc' as const,
      id: entry.id,
      date: entry.completed_at,
      label: `Controllo Qualità #${entry.cycle_index}`,
      color: 'bg-emerald-500',
      user: entry.profiles?.full_name || null,
      note: null
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ===== RENDER =====
  return (
    <div className="lg:col-span-1 space-y-6">
      
      {/* Info Rapide */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Clock className="h-5 w-5 mr-2 text-gray-500" />
          Info Rapide
        </h3>
        
        <div className="space-y-4">
          <div>
            <span className="block text-sm font-medium text-gray-500">Data Apertura</span>
            <p className="text-gray-900">{formatDate(busta.data_apertura)}</p>
          </div>

          <div>
            <span className="block text-sm font-medium text-gray-500">Giorni Aperti</span>
            <p className="text-lg font-semibold text-blue-600">
              {calculateDaysOpen(busta.data_apertura)} giorni
            </p>
          </div>

          <div>
            <span className="block text-sm font-medium text-gray-500">Creato da</span>
            <p className="text-gray-900">{busta.profiles?.full_name || 'Utente sconosciuto'}</p>
          </div>

          {busta.updated_at && (
            <div>
              <span className="block text-sm font-medium text-gray-500">Ultimo Aggiornamento</span>
              <p className="text-gray-900 text-sm">{formatDate(busta.updated_at)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Timeline Stati */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <FileText className="h-5 w-5 mr-2 text-gray-500" />
          Timeline Stati
        </h3>
        
        <div className="space-y-4">
          {timelineEntries.map((entry) => (
            <div key={`${entry.type}-${entry.id}`} className="flex items-start space-x-3">
              <div className={`w-3 h-3 rounded-full mt-1.5 ${entry.color}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {entry.type === 'status' ? entry.label.replace(/_/g, ' ').toUpperCase() : entry.label}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDate(entry.date)}
                </p>
                {entry.user && (
                  <p className="text-xs text-gray-400">
                    da {entry.user}
                  </p>
                )}
                {entry.note && (
                  <p className="text-xs text-gray-600 mt-1">
                    {entry.note}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}                                                                           
