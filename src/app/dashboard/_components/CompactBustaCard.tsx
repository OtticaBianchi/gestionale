// app/dashboard/_components/CompactBustaCard.tsx

import { Clock, Bell, Phone, PhoneOff } from 'lucide-react';
import { BustaWithCliente, OrdineMaterialeEssenziale } from '@/types/shared.types';
import { isOtticaBianchiName, isRealCustomerPhone, isShopPhone } from '@/lib/clients/phoneRules';

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

const abbreviateName = (cognome: string, nome: string) => {
  const inizialeNome = nome.charAt(0).toUpperCase();
  return `${cognome} ${inizialeNome}.`;
};

const getTipoLavorazioneSigla = (tipo: string | null) => {
  const tipiLavorazione: Record<string, string> = {
    OCV: 'OCV',
    OV: 'OV',
    OS: 'OS',
    LV: 'LV',
    LS: 'LS',
    LAC: 'LAC',
    ACC: 'ACC',
    RIC: 'RIC',
    LAB: 'LAB',
    SA: 'SA',
    SG: 'SG',
    CT: 'CT',
    ES: 'ES',
    REL: 'REL',
    FT: 'FT',
    SPRT: 'SPRT',
    VFT: 'VFT',
    BR: 'BR'
  };
  return tipo ? tipiLavorazione[tipo] || tipo : '---';
};

const getMaterialsStats = (ordini: OrdineMaterialeEssenziale[]) => {
  const stats = {
    da_ordinare: 0,
    ordinati: 0,
    in_arrivo: 0,
    in_ritardo: 0,
    consegnati: 0
  };

  ordini.forEach(ordine => {
    const stato = (ordine.stato || '').toLowerCase();

    if (stato === 'annullato') return;

    if (ordine.da_ordinare === true) {
      stats.da_ordinare++;
    } else if (stato === 'ordinato') {
      stats.ordinati++;
    } else if (stato === 'in_arrivo') {
      stats.in_arrivo++;
    } else if (stato === 'in_ritardo') {
      stats.in_ritardo++;
    } else if (stato === 'consegnato') {
      stats.consegnati++;
    }
  });

  return stats;
};

const getPriorityBadge = (priorita: string, hasDelays: boolean) => {
  if (priorita === 'critica') {
    return { text: 'CRITICA', className: 'text-red-700 font-bold' };
  }
  if (priorita === 'urgente') {
    return { text: 'URGENTE', className: 'text-orange-600 font-bold' };
  }
  if (hasDelays) {
    return { text: 'RITARDO', className: 'text-amber-600 font-semibold' };
  }
  return null;
};

export default function CompactBustaCard({ busta, onClick }: CompactBustaCardProps) {
  const daysOpen = calculateDaysOpen(busta.data_apertura);
  const cliente = busta.clienti;
  const displayName = cliente
    ? abbreviateName(cliente.cognome, cliente.nome)
    : 'Cliente sconosciuto';

  const hasDelays = (busta.ordini_materiali || []).some(
    (ordine) => ordine.stato === 'in_ritardo'
  );

  const openActionCount = (busta.ordini_materiali || []).filter(
    ordine => ordine.needs_action && !ordine.needs_action_done
  ).length;
  const hasOpenActions = openActionCount > 0;
  const isOtticaBianchi = cliente ? isOtticaBianchiName(cliente.nome, cliente.cognome) : false;
  const isShopPhoneValue = cliente ? isShopPhone(cliente.telefono) : false;
  const hasMissingPhone = cliente
    ? (!isRealCustomerPhone(cliente.telefono) && !(isOtticaBianchi && isShopPhoneValue))
    : false;
  const showBellReminder = hasOpenActions || busta.is_suspended;
  const bellReminderReasons: string[] = [];
  if (busta.is_suspended) bellReminderReasons.push('Busta sospesa: follow-up richiesto');
  if (hasOpenActions) bellReminderReasons.push('Azione richiesta: promemoria aperto');
  const bellReminderTooltip = bellReminderReasons.join(' • ');
  const missingPhoneTooltip = 'Telefono cliente mancante';

  const materialsStats = getMaterialsStats(busta.ordini_materiali || []);
  const hasPaymentPlan = busta.payment_plan && busta.payment_plan.payment_installments && busta.payment_plan.payment_installments.length > 0;

  const priorityStyles: Record<string, string> = {
    normale: 'border-l-gray-400',
    urgente: 'border-l-orange-500',
    critica: 'border-l-red-600'
  };

  const suspendedClasses = busta.is_suspended
    ? 'bg-yellow-50 border border-yellow-200'
    : 'bg-white';

  return (
    <div
      onClick={onClick}
      data-busta-id={busta.id}
      className={`
        ${suspendedClasses} rounded-md shadow-sm p-2.5 mb-2 border-l-4
        hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer
        ${priorityStyles[busta.priorita]}
      `}
    >
      {/* Row 1: ID + Nome abbreviato + Tipo Lavorazione */}
      <div className="flex justify-between items-center mb-1.5">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-bold text-gray-600">{busta.readable_id}</span>
          <span className="text-xs text-gray-900 truncate">
            {displayName}
          </span>
        </div>
        <span className="text-xs text-gray-700 font-semibold ml-2 flex-shrink-0">
          {getTipoLavorazioneSigla(busta.tipo_lavorazione)}
        </span>
      </div>

      {/* Row 2: Icone materiali + Badge sospesa/rate */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2 text-xs">
          {materialsStats.da_ordinare > 0 && (
            <span className="flex items-center gap-0.5 text-orange-700">
              🛒 x{materialsStats.da_ordinare}
            </span>
          )}
          {materialsStats.in_ritardo > 0 && (
            <span className="flex items-center gap-0.5 text-red-700">
              ⚠️ x{materialsStats.in_ritardo}
            </span>
          )}
          {materialsStats.in_arrivo > 0 && (
            <span className="flex items-center gap-0.5 text-cyan-700">
              🚚 x{materialsStats.in_arrivo}
            </span>
          )}
          {materialsStats.ordinati > 0 && (
            <span className="flex items-center gap-0.5 text-blue-700">
              📦 x{materialsStats.ordinati}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Red phone icon when call is pending */}
          {busta.richiede_telefonata && !busta.telefonata_completata && (
            <span
              className="flex items-center justify-center w-5 h-5 bg-red-100 rounded border border-red-300"
              title={`Da chiamare - Assegnato a: ${busta.telefonata_assegnata_a || 'N/A'}`}
            >
              <Phone className="h-3 w-3 text-red-600" />
            </span>
          )}
          {showBellReminder && (
            <span
              className="text-[10px] font-semibold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200 flex items-center gap-1"
              title={bellReminderTooltip}
            >
              <Bell className="h-3 w-3" />
              {hasOpenActions && <span>!{openActionCount}</span>}
            </span>
          )}
          {hasMissingPhone && (
            <span
              className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-1"
              title={missingPhoneTooltip}
            >
              <PhoneOff className="h-3 w-3" />
              <span>No Tel</span>
            </span>
          )}
          {busta.is_suspended && (
            <span className="text-[10px] font-bold text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded">
              SOSP
            </span>
          )}
          {hasPaymentPlan && (
            <span className="text-[10px] font-semibold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
              RATE
            </span>
          )}
        </div>
      </div>

      {/* Row 3: Giorni apertura */}
      <div className="flex items-center gap-1 text-[11px] text-gray-500">
        <Clock className="h-3 w-3" />
        <span>{daysOpen} giorni</span>
      </div>
    </div>
  );
}
