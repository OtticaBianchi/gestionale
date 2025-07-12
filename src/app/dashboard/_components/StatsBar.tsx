// app/dashboard/_components/StatsBar.tsx
'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import { 
  Users, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Package, 
  Eye,
  TrendingUp 
} from 'lucide-react';

type BustaWithCliente = Database['public']['Tables']['buste']['Row'] & {
  clienti: Pick<Database['public']['Tables']['clienti']['Row'], 'nome' | 'cognome'> | null;
};

interface StatsBarProps {
  buste: BustaWithCliente[];
}

interface Stats {
  totaleBuste: number;
  nuove: number;
  inLavorazione: number;
  pronteRitiro: number;
  urgenti: number;
  critiche: number;
  busteOggi: number;
  mediaGiorni: number;
}

export default function StatsBar({ buste }: StatsBarProps) {
  const [stats, setStats] = useState<Stats>({
    totaleBuste: 0,
    nuove: 0,
    inLavorazione: 0,
    pronteRitiro: 0,
    urgenti: 0,
    critiche: 0,
    busteOggi: 0,
    mediaGiorni: 0,
  });

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Calcola statistiche dalle buste
  useEffect(() => {
    const calculateStats = () => {
      const today = new Date().toISOString().split('T')[0];
      
      const newStats: Stats = {
        totaleBuste: buste.length,
        nuove: buste.filter(b => b.stato_attuale === 'nuove').length,
        inLavorazione: buste.filter(b => 
          ['materiali_ordinati', 'materiali_parzialmente_arrivati', 'materiali_arrivati', 'in_lavorazione'].includes(b.stato_attuale)
        ).length,
        pronteRitiro: buste.filter(b => b.stato_attuale === 'pronto_ritiro').length,
        urgenti: buste.filter(b => b.priorita === 'urgente').length,
        critiche: buste.filter(b => b.priorita === 'critica').length,
        busteOggi: buste.filter(b => b.data_apertura.startsWith(today)).length,
        mediaGiorni: 0, // Calcoleremo dopo
      };

      // Calcola media giorni aperti
      if (buste.length > 0) {
        const totalGiorni = buste.reduce((sum, busta) => {
          const dataApertura = new Date(busta.data_apertura);
          const oggi = new Date();
          const diffTime = Math.abs(oggi.getTime() - dataApertura.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return sum + diffDays;
        }, 0);
        newStats.mediaGiorni = Math.round(totalGiorni / buste.length);
      }

      setStats(newStats);
    };

    calculateStats();
  }, [buste]);

  // Subscription per aggiornamenti real-time
  useEffect(() => {
    const channel = supabase
      .channel('buste-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'buste'
        },
        () => {
          // Trigger re-fetch dei dati nella componente parent
          window.location.reload(); // Semplice per ora, miglioreremo
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const statCards = [
    {
      name: 'Totale',
      value: stats.totaleBuste,
      icon: Package,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      name: 'Nuove',
      value: stats.nuove,
      icon: Eye,
      color: 'bg-green-500',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      name: 'In Corso',
      value: stats.inLavorazione,
      icon: Users,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      name: 'Pronte',
      value: stats.pronteRitiro,
      icon: CheckCircle,
      color: 'bg-purple-500',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      name: 'Urgenti',
      value: stats.urgenti,
      icon: Clock,
      color: 'bg-orange-500',
      textColor: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      name: 'Critiche',
      value: stats.critiche,
      icon: AlertTriangle,
      color: 'bg-red-500',
      textColor: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      name: 'Oggi',
      value: stats.busteOggi,
      icon: TrendingUp,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    {
      name: 'Media gg',
      value: stats.mediaGiorni,
      icon: Clock,
      color: 'bg-gray-500',
      textColor: 'text-gray-600',
      bgColor: 'bg-gray-50'
    },
  ];

  return (
    <div className="bg-white shadow-sm border-b border-gray-200 py-3 px-4">
      <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
        {statCards.map((stat) => (
          <div key={stat.name} className={`${stat.bgColor} rounded-lg p-2.5 transition-all hover:shadow-md`}>
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide truncate">
                  {stat.name}
                </p>
                <p className={`text-xl font-bold ${stat.textColor} leading-tight`}>
                  {stat.value}
                </p>
              </div>
              <div className={`${stat.color} p-1.5 rounded-md flex-shrink-0`}>
                <stat.icon className="h-3 w-3 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Indicatore di connessione real-time - più piccolo */}
      <div className="mt-2 flex items-center justify-end">
        <div className="flex items-center space-x-1 text-xs text-gray-500">
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-xs">Real-time attivo</span>
        </div>
      </div>
    </div>
  );
}