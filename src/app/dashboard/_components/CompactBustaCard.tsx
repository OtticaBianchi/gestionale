// app/dashboard/_components/CompactBustaCard.tsx

import { Clock } from 'lucide-react';
import { BustaWithCliente } from '@/types/shared.types';

interface CompactBustaCardProps {
  busta: BustaWithCliente;
  onClick: () => void;
}

const calculateDaysOpen = (dataApertura: string) => {
  const openDate = new Date(dataApertura);
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - openDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getTipoLavorazioneSigla = (tipo: string | null) => {
  const tipiLavorazione: Record<string, string> = {
    OCV: '👓 OCV',
    OV: '👓 OV',
    OS: '🕶️ OS',
    LV: '🔍 LV',
    LS: '🌅 LS',
    LAC: '👁️ LAC',
    ACC: '🔧 ACC',
    RIC: '🔄 RIC',
    RIP: '🔨 RIP',
    SA: '📐 SA',
    SG: '🧵 SG',
    CT: '👁️ CT',
    ES: '🔬 ES',
    REL: '📋 REL',
    FT: '🧾 FT',
    SPRT: '🚴 SPRT',
    VFT: '🔍 VFT'
  };
  return tipo ? tipiLavorazione[tipo] || tipo : '❓ ---';
};

const getPriorityBadge = (priorita: string, hasDelays: boolean) => {
  if (priorita === 'critica') {
    return { text: '🔴 CRITICA', className: 'text-red-700 font-bold' };
  }
  if (priorita === 'urgente') {
    return { text: '🟠 URGENTE', className: 'text-orange-600 font-bold' };
  }
  if (hasDelays) {
    return { text: '⚠️ IN RITARDO', className: 'text-amber-600 font-semibold' };
  }
  return null;
};

export default function CompactBustaCard({ busta, onClick }: CompactBustaCardProps) {
  const daysOpen = calculateDaysOpen(busta.data_apertura);
  const cliente = busta.clienti;
  const displayName = cliente ? `${cliente.cognome} ${cliente.nome}` : 'Cliente non specificato';

  // Check if any orders are delayed (in_ritardo)
  const hasDelays = (busta.ordini_materiali || []).some(
    (ordine) => ordine.stato === 'in_ritardo'
  );

  const priorityBadge = getPriorityBadge(busta.priorita, hasDelays);

  const priorityStyles: Record<string, string> = {
    normale: 'border-l-gray-400',
    urgente: 'border-l-orange-500',
    critica: 'border-l-red-600'
  };

  return (
    <div
      onClick={onClick}
      data-busta-id={busta.id}
      className={`
        bg-white rounded-md shadow-sm p-3 mb-2 border-l-4
        hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer
        ${priorityStyles[busta.priorita]}
        ${busta.is_suspended ? 'bg-gray-50 opacity-90' : ''}
      `}
    >
      {/* Row 1: ID | Priority | Tipo Lav */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-bold text-gray-700 flex-shrink-0">
            {busta.readable_id}
          </span>
          {busta.is_suspended && (
            <span className="text-[10px] font-bold text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded">
              SOSP
            </span>
          )}
          {priorityBadge && (
            <span className={`text-[10px] flex-shrink-0 ${priorityBadge.className}`}>
              {priorityBadge.text}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-600 flex-shrink-0 ml-2">
          {getTipoLavorazioneSigla(busta.tipo_lavorazione)}
        </span>
      </div>

      {/* Row 2: Nome | Days */}
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium truncate flex-1 min-w-0 ${
          priorityBadge ? priorityBadge.className.split(' ')[0] : 'text-gray-900'
        }`}>
          {displayName}
        </span>
        <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0 ml-2">
          <Clock className="h-3 w-3" />
          <span>{daysOpen}g</span>
        </div>
      </div>
    </div>
  );
}
