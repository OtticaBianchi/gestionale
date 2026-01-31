// app/dashboard/_components/BustaCard.tsx

import type { ReactNode } from 'react';
import { Clock, AlertTriangle, Euro, Banknote, Landmark, ListOrdered, Coins, Receipt, Bell, Phone, PhoneOff } from 'lucide-react';
import Link from 'next/link';
import { BustaWithCliente, OrdineMaterialeEssenziale } from '@/types/shared.types';
import { isOtticaBianchiName, isRealCustomerPhone, isShopPhone } from '@/lib/clients/phoneRules';

interface BustaCardProps {
  busta: BustaWithCliente;
}

const currencyFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

const formatCurrency = (value: number) => currencyFormatter.format(Math.max(value, 0));

const calculateDaysOpen = (dataApertura: string) => {
  const openDate = new Date(dataApertura);
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - openDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getTipoLavorazioneSigla = (tipo: string | null) => {
  // Ritorna solo la sigla senza icona
  return tipo || '---';
};

// Calcola le statistiche degli ordini materiali per le icone
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

    // Salta gli annullati
    if (stato === 'annullato') return;

    // Conta in base allo stato
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

const getStatoOrdineEmoji = (stato: string | null) => {
  const stati: Record<string, string> = {
    da_ordinare: '🛒',
    ordinato: '📦',
    in_ritardo: '⏰',
    accettato_con_riserva: '🔄',
    rifiutato: '❌',
    consegnato: '✅',
    annullato: '🚫'
  };
  const lower = (stato || 'ordinato').toLowerCase();
  if (lower === 'sbagliato') return '⚠️';
  return stati[lower] || '📦';
};

const getDelayLevel = (ordini: OrdineMaterialeEssenziale[]) => {
  const ritardi = ordini.filter(o => (o.stato || 'ordinato') === 'in_ritardo').length;
  const rifiutati = ordini.filter(o => (o.stato || 'ordinato') === 'rifiutato').length;
  if (rifiutati > 0) return 'critical';
  if (ritardi >= 2) return 'severe';
  if (ritardi === 1) return 'warning';
  return 'none';
};

type AvailabilityStatus = 'disponibile' | 'riassortimento' | 'esaurito';

const AVAILABILITY_PRIORITY: Record<AvailabilityStatus, number> = {
  disponibile: 0,
  riassortimento: 1,
  esaurito: 2
};

const AVAILABILITY_BADGE: Record<AvailabilityStatus, { label: string; className: string }> = {
  disponibile: {
    label: 'Disponibile',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200'
  },
  riassortimento: {
    label: 'Riassortimento',
    className: 'bg-amber-100 text-amber-700 border border-amber-200'
  },
  esaurito: {
    label: 'Esaurito',
    className: 'bg-red-100 text-red-700 border border-red-200'
  }
};

const parseDateSafe = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizePlanType = (
  type: string | null | undefined
): 'saldo_unico' | 'installments' | 'finanziamento_bancario' | 'no_payment' | 'none' => {
  if (type === 'installments') return 'installments';
  if (type === 'saldo_unico') return 'saldo_unico';
  if (type === 'finanziamento_bancario') return 'finanziamento_bancario';
  if (type === 'nessun_pagamento' || type === 'no_payment') return 'no_payment';
  return 'none';
};

const mapLegacyPaymentType = (
  modalita: string | null | undefined
): 'saldo_unico' | 'installments' | 'finanziamento_bancario' | 'no_payment' | 'none' => {
  if (!modalita) return 'none';
  if (modalita === 'saldo_unico') return 'saldo_unico';
  if (modalita === 'finanziamento') return 'finanziamento_bancario';
  if (modalita === 'due_rate' || modalita === 'tre_rate') return 'installments';
  if (modalita === 'nessun_pagamento') return 'no_payment';
  return 'none';
};

interface PaymentBadge {
  label: string;
  className: string;
  sublabel?: string;
  icon?: ReactNode;
}

type InstallmentOverview = {
  installment_number: number;
  due_date: string;
  is_completed: boolean;
  paid_amount: number;
};

const buildPaymentBadge = (
  planType: 'saldo_unico' | 'installments' | 'finanziamento_bancario' | 'no_payment' | 'none',
  outstanding: number,
  paidCount: number,
  totalInstallments: number,
  planCompleted: boolean,
  totalAmount: number,
  acconto: number,
  showSetupWarning: boolean
): PaymentBadge | null => {
  if (planType === 'installments' && totalInstallments > 0) {
    const allPaid = planCompleted || outstanding <= 0.5;
    if (allPaid) {
      return {
        label: 'PAGATO',
        className: 'bg-green-50 text-green-700 border border-green-200',
        icon: <Banknote className="w-3 h-3 mr-1" />, 
        sublabel: totalAmount > 0 ? `Totale ${formatCurrency(totalAmount)}` : undefined
      };
    }

    const nextInstallmentNumber = Math.min(totalInstallments, Math.max(paidCount + 1, 1));
    return {
      label: `Rata ${nextInstallmentNumber} di ${totalInstallments}`,
      className: 'bg-orange-50 text-orange-700 border border-orange-200',
      icon: <ListOrdered className="w-3 h-3 mr-1" />, 
      sublabel: outstanding > 0.5 ? `Residuo ${formatCurrency(outstanding)}` : undefined
    };
  }

  if (planType === 'no_payment') {
    return {
      label: 'NESSUN INCASSO',
      className: 'bg-slate-100 text-slate-700 border border-slate-200',
      icon: <Receipt className="w-3 h-3 mr-1" />,
      sublabel: 'Lavorazione gratuita'
    };
  }

  if (planType === 'saldo_unico') {
    const saldoOk = planCompleted || outstanding <= 0.5;
    return {
      label: saldoOk ? 'PAGATO' : 'Saldo da incassare',
      className: saldoOk
        ? 'bg-green-50 text-green-700 border border-green-200'
        : 'bg-blue-50 text-blue-700 border border-blue-200',
      icon: saldoOk ? <Banknote className="w-3 h-3 mr-1" /> : undefined,
      sublabel: saldoOk
        ? totalAmount > 0 ? `Totale ${formatCurrency(totalAmount)}` : undefined
        : `Da incassare ${formatCurrency(outstanding)}`
    };
  }

  if (planType === 'finanziamento_bancario') {
    return {
      label: 'FINANZIAMENTO',
      className: 'bg-blue-50 text-blue-700 border border-blue-200',
      icon: <Landmark className="w-3 h-3 mr-1" />, 
      sublabel: totalAmount > 0 ? `Totale ${formatCurrency(totalAmount)}` : undefined
    };
  }

  if (!showSetupWarning) {
    return null;
  }

  return {
    label: 'Piano da impostare',
    className: 'bg-gray-100 text-gray-600 border border-gray-200',
    icon: <Coins className="w-3 h-3 mr-1" />, 
    sublabel: totalAmount > 0 ? `Totale ${formatCurrency(totalAmount)}` : undefined
  };
};

const getInstallmentAlert = (
  planType: 'saldo_unico' | 'installments' | 'finanziamento_bancario' | 'no_payment' | 'none',
  installments: InstallmentOverview[],
  planCompleted: boolean
) => {
  if (planType !== 'installments' || installments.length === 0 || planCompleted) return null;

  const today = new Date();
  const pending = installments.filter(inst => !inst.is_completed);
  if (pending.length === 0) return null;

  const overdue = pending
    .filter(inst => new Date(inst.due_date).getTime() < today.getTime())
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  if (overdue.length > 0) {
    const first = overdue[0];
    return {
      className: 'bg-red-100 text-red-700',
      label: `🔴 Rata ${first.installment_number}/${installments.length} scaduta`
    };
  }

  const soon = pending
    .map(inst => {
      const dueDate = new Date(inst.due_date);
      const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return { inst, diffDays };
    })
    .filter(({ diffDays }) => diffDays >= 0 && diffDays <= 7)
    .sort((a, b) => a.diffDays - b.diffDays);

  if (soon.length > 0) {
    const next = soon[0];
    return {
      className: 'bg-yellow-100 text-yellow-700',
      label: next.diffDays === 0
        ? `🟡 Rata ${next.inst.installment_number} oggi`
        : `🟡 Rata ${next.inst.installment_number} tra ${next.diffDays} gg`
    };
  }

  return null;
};

const sortOrdersByPriority = (ordini: OrdineMaterialeEssenziale[]) => {
  return [...ordini].sort((a, b) => {
    const priorita: Record<string, number> = { rifiutato: 3, in_ritardo: 2 };
    const statoA = a.stato || 'ordinato';
    const statoB = b.stato || 'ordinato';
    const prioA = priorita[statoA] || 1;
    const prioB = priorita[statoB] || 1;
    if (prioA !== prioB) return prioB - prioA;
    return a.descrizione_prodotto.localeCompare(b.descrizione_prodotto);
  });
};

const processPaymentData = (busta: BustaWithCliente) => {
  const paymentPlan = busta.payment_plan;
  const legacyInfo = busta.info_pagamenti;

  const installments: InstallmentOverview[] = (paymentPlan?.payment_installments || []).map(inst => ({
    installment_number: inst.installment_number,
    due_date: inst.due_date,
    is_completed: inst.is_completed === true,
    paid_amount: inst.paid_amount || 0
  }));

  const totalAmount = paymentPlan?.total_amount ?? legacyInfo?.prezzo_finale ?? 0;
  const acconto = paymentPlan?.acconto ?? legacyInfo?.importo_acconto ?? 0;
  const paidInstallmentsAmount = installments.reduce((sum, inst) => sum + (inst.paid_amount || 0), 0);
  const paidCount = installments.filter(inst => inst.is_completed).length;
  const totalInstallments = installments.length;
  const planCompleted = paymentPlan?.is_completed ?? (legacyInfo?.is_saldato === true);
  const outstandingRaw = totalAmount - Math.max(acconto, 0) - paidInstallmentsAmount;
  const outstanding = planCompleted ? 0 : Math.max(outstandingRaw, 0);

  return {
    paymentPlan,
    legacyInfo,
    installments,
    totalAmount,
    acconto,
    paidCount,
    totalInstallments,
    planCompleted,
    outstanding
  };
};

const determinePlanType = (
  paymentPlan: any,
  legacyInfo: any,
  totalAmount: number,
  totalInstallments: number
): 'saldo_unico' | 'installments' | 'finanziamento_bancario' | 'no_payment' | 'none' => {
  let normalizedPlanType = paymentPlan
    ? normalizePlanType(paymentPlan.payment_type)
    : mapLegacyPaymentType(legacyInfo?.modalita_saldo);

  const noteMarksNoPayment = legacyInfo?.note_pagamento === 'NESSUN_INCASSO';
  const zeroBalanceClosed = !paymentPlan && (legacyInfo?.is_saldato ?? false) && (totalAmount ?? 0) <= 0.5;

  if (!paymentPlan && (noteMarksNoPayment || zeroBalanceClosed)) {
    normalizedPlanType = 'no_payment';
  }

  const hasInstallmentsPlan = normalizedPlanType === 'installments' && totalInstallments > 0 && totalAmount > 0;
  const hasSaldoPlan = normalizedPlanType === 'saldo_unico' && totalAmount > 0;
  const hasFinancingPlan = normalizedPlanType === 'finanziamento_bancario' && totalAmount > 0;
  const hasNoPaymentPlan = normalizedPlanType === 'no_payment';

  if (!(hasInstallmentsPlan || hasSaldoPlan || hasFinancingPlan || hasNoPaymentPlan)) {
    normalizedPlanType = 'none';
  }

  return normalizedPlanType;
};

const generateBadgesAndAlerts = (
  busta: BustaWithCliente,
  normalizedPlanType: 'saldo_unico' | 'installments' | 'finanziamento_bancario' | 'no_payment' | 'none',
  paymentData: ReturnType<typeof processPaymentData>
) => {
  const shouldShowSetupWarning = normalizedPlanType === 'none' &&
    (busta.stato_attuale === 'pronto_ritiro' || busta.stato_attuale === 'consegnato_pagato');

  const paymentBadge = buildPaymentBadge(
    normalizedPlanType,
    paymentData.outstanding,
    paymentData.paidCount,
    paymentData.totalInstallments,
    paymentData.planCompleted,
    paymentData.totalAmount,
    paymentData.acconto,
    shouldShowSetupWarning
  );

  const installmentAlert = getInstallmentAlert(
    normalizedPlanType,
    paymentData.installments,
    paymentData.planCompleted
  );

  return { paymentBadge, installmentAlert };
};

export default function BustaCard({ busta }: BustaCardProps) {
  const daysOpen = calculateDaysOpen(busta.data_apertura);
  const cliente = busta.clienti;
  const rawOrders = busta.ordini_materiali || [];
  const openActionOrders = rawOrders.filter(
    ordine => ordine.needs_action && !ordine.needs_action_done
  );
  const openActionCount = openActionOrders.length;
  const hasOpenActions = openActionCount > 0;
  const activeOrders = rawOrders.filter((ordine) => (ordine.stato || '').toLowerCase() !== 'annullato');
  const displayOrders = activeOrders.length > 0 ? activeOrders : rawOrders;
  const ordiniOrdinati = sortOrdersByPriority(displayOrders);
  const delayLevel = getDelayLevel(displayOrders);
  const isOtticaBianchi = cliente ? isOtticaBianchiName(cliente.nome, cliente.cognome) : false;
  const isShopPhoneValue = cliente ? isShopPhone(cliente.telefono) : false;
  const hasMissingPhone = cliente
    ? (!isRealCustomerPhone(cliente.telefono) && !(isOtticaBianchi && isShopPhoneValue))
    : false;

  // Calcola le statistiche dei materiali per le icone
  const materialsStats = getMaterialsStats(displayOrders);

  const availabilityOrders = activeOrders;
  let worstAvailability: AvailabilityStatus | null = null;
  const availabilityReminders: Date[] = [];

  if (availabilityOrders.length > 0) {
    worstAvailability = 'disponibile';
    availabilityOrders.forEach((ordine) => {
      const stato = (ordine.stato_disponibilita || 'disponibile') as AvailabilityStatus;
      if (AVAILABILITY_PRIORITY[stato] > AVAILABILITY_PRIORITY[worstAvailability!]) {
        worstAvailability = stato;
      }
      const promemoria = parseDateSafe(ordine.promemoria_disponibilita);
      if (promemoria) {
        availabilityReminders.push(promemoria);
      }
    });
  }

  const nextAvailabilityReminder = availabilityReminders.length > 0
    ? availabilityReminders.reduce((min, date) => (date < min ? date : min))
    : null;

  const availabilityBadge = worstAvailability ? AVAILABILITY_BADGE[worstAvailability] : null;
  const showAvailabilityBadge =
    busta.stato_attuale === 'materiali_ordinati' &&
    availabilityBadge !== null &&
    worstAvailability !== null &&
    worstAvailability !== 'disponibile';

  let availabilityReminderDue = false;
  let nextAvailabilityReminderLabel: string | null = null;
  if (showAvailabilityBadge && nextAvailabilityReminder) {
    availabilityReminderDue = nextAvailabilityReminder.getTime() <= Date.now();
    nextAvailabilityReminderLabel = nextAvailabilityReminder.toLocaleDateString('it-IT');
  }

  // Simple delivery warning check
  const showDeliveryWarning = busta.metodo_consegna &&
    busta.stato_consegna === 'in_attesa' &&
    busta.metodo_consegna !== 'da_ritirare' &&
    busta.data_selezione_consegna &&
    (() => {
      const days = Math.floor((Date.now() - new Date(busta.data_selezione_consegna).getTime()) / (1000 * 60 * 60 * 24));
      return days >= 2;
    })();

  const paymentData = processPaymentData(busta);
  const normalizedPlanType = determinePlanType(
    paymentData.paymentPlan,
    paymentData.legacyInfo,
    paymentData.totalAmount,
    paymentData.totalInstallments
  );

  const { paymentBadge, installmentAlert } = generateBadgesAndAlerts(
    busta,
    normalizedPlanType,
    paymentData
  );

  const priorityStyles: Record<string, string> = {
    normale: 'border-l-gray-400',
    urgente: 'border-l-orange-500',
    critica: 'border-l-red-600'
  };

  const delayIndicator: Record<string, JSX.Element | null> = {
    none: null,
    warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
    severe: <AlertTriangle className="h-4 w-4 text-red-500" />,
    critical: <AlertTriangle className="h-4 w-4 text-red-600" />
  };

  const suspendedClasses = busta.is_suspended
    ? 'bg-yellow-50 border border-yellow-200'
    : 'bg-white/90 border border-slate-200/80';

  const showBellReminder = hasOpenActions || busta.is_suspended;
  const bellReminderReasons: string[] = [];
  if (busta.is_suspended) bellReminderReasons.push('Busta sospesa: follow-up richiesto');
  if (hasOpenActions) bellReminderReasons.push('Azione richiesta: promemoria aperto');
  const bellReminderTooltip = bellReminderReasons.join(' • ');
  const missingPhoneTooltip = 'Telefono cliente mancante';

  return (
    <Link href={`/dashboard/buste/${busta.id}`}>
      <div
        data-busta-id={busta.id}
        className={`
          ${suspendedClasses} rounded-xl shadow-[0_14px_32px_-26px_rgba(15,23,42,0.6)] p-4 mb-3 border-l-4
          hover:shadow-[0_20px_45px_-30px_rgba(15,23,42,0.7)] hover:-translate-y-1 hover:border-[var(--teal)]/60 transition-all cursor-pointer
          ${priorityStyles[busta.priorita]}
        `}
      >
        {/* Row 1: ID + Nome completo + Tipo Lavorazione */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-sm font-bold text-slate-700">{busta.readable_id}</span>
            <span className="text-sm font-medium text-slate-900">
              {cliente ? `${cliente.cognome} ${cliente.nome}` : 'Cliente sconosciuto'}
            </span>
          </div>
          <span className="text-sm text-slate-700 font-semibold ml-2 flex-shrink-0">
            {getTipoLavorazioneSigla(busta.tipo_lavorazione)}
          </span>
        </div>

        {/* Row 2: Badge stato materiali/sospensione/rate */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {materialsStats.da_ordinare > 0 && (
            <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full font-medium ring-1 ring-black/5">
              🛒 {materialsStats.da_ordinare} da ordinare
            </span>
          )}
          {materialsStats.in_ritardo > 0 && (
            <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium ring-1 ring-black/5">
              ⚠️ {materialsStats.in_ritardo} in ritardo
            </span>
          )}
          {materialsStats.in_arrivo > 0 && (
            <span className="text-xs px-2 py-1 bg-cyan-100 text-cyan-700 rounded-full font-medium ring-1 ring-black/5">
              🚚 {materialsStats.in_arrivo} in arrivo
            </span>
          )}
          {materialsStats.ordinati > 0 && (
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium ring-1 ring-black/5">
              📦 {materialsStats.ordinati} ordinati
            </span>
          )}
          {busta.is_suspended && (
            <span className="text-xs font-bold text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full ring-1 ring-black/5">
              SOSPESA
            </span>
          )}
          {showBellReminder && (
            <span
              className="text-xs font-semibold text-red-700 bg-red-50 px-2 py-1 rounded-full border border-red-200 inline-flex items-center gap-1"
              title={bellReminderTooltip}
            >
              <Bell className="h-3.5 w-3.5" />
              {hasOpenActions && <span>!{openActionCount}</span>}
            </span>
          )}
          {hasMissingPhone && (
            <span
              className="text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-1 rounded-full border border-amber-200 inline-flex items-center gap-1"
              title={missingPhoneTooltip}
            >
              <PhoneOff className="h-3.5 w-3.5" />
              <span>No Tel</span>
            </span>
          )}
          {/* Red phone icon when call is pending */}
          {busta.richiede_telefonata && !busta.telefonata_completata && (
            <span
              className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded-full border border-red-300 inline-flex items-center gap-1"
              title={`Da chiamare - Assegnato a: ${busta.telefonata_assegnata_a || 'N/A'}`}
            >
              <Phone className="h-3.5 w-3.5" />
              <span>Da chiamare</span>
            </span>
          )}
          {installmentAlert && (
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${installmentAlert.className}`}>
              {installmentAlert.label}
            </span>
          )}
        </div>

        {/* Row 3: Dettagli prezzo/pagamento (se presente) */}
        {paymentBadge && (
          <div className="mb-3">
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${paymentBadge.className} inline-flex items-center`}>
              {paymentBadge.icon}
              <span>{paymentBadge.label}</span>
            </span>
            {paymentBadge.sublabel && (
              <span className="text-xs text-slate-600 ml-2">{paymentBadge.sublabel}</span>
            )}
          </div>
        )}

        {/* Row 4: Lista completa prodotti con dettagli */}
        {displayOrders.length > 0 && (
          <div className="mb-2 space-y-2">
            {ordiniOrdinati.map((ordine) => (
              <div key={ordine.id} className="flex items-start gap-2">
                <span className="text-sm flex-shrink-0">
                  {getStatoOrdineEmoji(ordine.stato)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-800 leading-relaxed">
                    {ordine.descrizione_prodotto}
                  </p>
                  {ordine.note && (
                    <p className="text-[10px] text-slate-500 italic mt-0.5">
                      Note: {ordine.note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer: Giorni aperti + Info prodotti */}
        <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-200">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Clock className="h-3.5 w-3.5" />
            <span>{daysOpen} giorni aperti</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            {displayOrders.length > 0 && <span>{displayOrders.length} prodott{displayOrders.length === 1 ? 'o' : 'i'}</span>}
            {normalizedPlanType !== 'none' && paymentData.outstanding > 0.5 && (
              <span className="flex items-center gap-1 text-orange-600 font-semibold">
                <Euro className="h-3.5 w-3.5" />
                {formatCurrency(paymentData.outstanding)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
