// app/dashboard/_components/BustaCard.tsx

import { Database } from '@/types/database.types';
import { Flame, Clock } from 'lucide-react';
import Link from 'next/link';

// Definiamo un tipo più specifico per la busta che riceviamo come prop
// Questo è un trucco utile di TypeScript per gestire le JOIN di Supabase.
type BustaWithCliente = Database['public']['Tables']['buste']['Row'] & {
  clienti: Pick<Database['public']['Tables']['clienti']['Row'], 'nome' | 'cognome'> | null;
};

interface BustaCardProps {
  busta: BustaWithCliente;
}

// Funzione helper per calcolare i giorni passati
const calculateDaysOpen = (dataApertura: string) => {
  const openDate = new Date(dataApertura);
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - openDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export default function BustaCard({ busta }: BustaCardProps) {
  const daysOpen = calculateDaysOpen(busta.data_apertura);

  const priorityStyles = {
    normale: 'border-l-gray-300',
    urgente: 'border-l-orange-500',
    critica: 'border-l-red-600',
  };

  return (
    <Link href={`/dashboard/buste/${busta.id}`}>
      <div 
        data-busta-id={busta.id}
        className={`
          bg-white rounded-md shadow-sm p-2 mb-2 border-l-4
          hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer
          ${priorityStyles[busta.priorita]}
        `}
      >
        <div className="flex justify-between items-start">
          <span className="text-xs font-bold text-gray-500">{busta.readable_id}</span>
          <div className="flex items-center gap-1">
            {busta.priorita !== 'normale' && <Flame className={`h-3 w-3 ${busta.priorita === 'critica' ? 'text-red-600' : 'text-orange-500'}`} />}
            {busta.is_suspended && <span className="text-xs font-bold text-yellow-600 bg-yellow-100 px-1 py-0.5 rounded-full">SOSP</span>}
          </div>
        </div>
        <p className="font-semibold text-gray-800 mt-1 text-sm leading-tight">
          {busta.clienti ? `${busta.clienti.cognome} ${busta.clienti.nome}` : 'Cliente non specificato'}
        </p>
        <p className="text-xs text-gray-600 truncate">{busta.tipo_lavorazione || 'Da specificare'}</p>
        <div className="flex justify-end items-center mt-1">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Clock size={10} />
            <span>{daysOpen}gg</span>
          </div>
        </div>
      </div>
    </Link>
  );
}