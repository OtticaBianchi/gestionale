// app/dashboard/_components/BustaCard.tsx

import type { ReactNode } from 'react';
import { Clock, AlertTriangle, Euro, Banknote, Landmark, ListOrdered, Coins, Receipt } from 'lucide-react';
import Link from 'next/link';
import { BustaWithCliente, OrdineMaterialeEssenziale } from '@/types/shared.types';

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
  const activeOrders = rawOrders.filter((ordine) => (ordine.stato || '').toLowerCase() !== 'annullato');
  const displayOrders = activeOrders.length > 0 ? activeOrders : rawOrders;
  const ordiniOrdinati = sortOrdersByPriority(displayOrders);
  const delayLevel = getDelayLevel(displayOrders);

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

  return (
    <Link href={`/dashboard/buste/${busta.id}`}>
      <div
        data-busta-id={busta.id}
        className={`
          bg-white rounded-lg shadow-sm p-4 mb-3 border-l-4 min-h-[190px]
          hover:shadow-lg hover:-translate-y-2 hover:border-blue-400 transition-all cursor-pointer
          ${priorityStyles[busta.priorita]}
          ${busta.is_suspended ? 'bg-gray-50 opacity-90' : ''}
        `}
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-600">{busta.readable_id}</span>
            {busta.is_suspended && (
              <span className="text-xs font-bold text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">
                SOSPESA
              </span>
            )}
            {installmentAlert && (
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${installmentAlert.className}`}>
                {installmentAlert.label}
              </span>
            )}
            {delayIndicator[delayLevel]}
            {showDeliveryWarning && (
              <AlertTriangle className="h-4 w-4 text-red-600 fill-red-100" />
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            {showAvailabilityBadge && availabilityBadge && (
              <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${availabilityBadge.className}`}>
                {availabilityBadge.label}
              </span>
            )}
            {paymentBadge && (
              <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${paymentBadge.className} flex items-center`}>
                {paymentBadge.icon}
                <span>{paymentBadge.label}</span>
              </span>
            )}
            {paymentBadge?.sublabel && (
              <span className="text-[10px] text-gray-500">{paymentBadge.sublabel}</span>
            )}
            {busta.priorita !== 'normale' && (
              <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                busta.priorita === 'critica'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-orange-100 text-orange-700'
              }`}>
                {busta.priorita.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <div className="mb-2">
          <h3 className="font-semibold text-gray-900 text-base leading-tight">
            {cliente ? `${cliente.cognome} ${cliente.nome}` : 'Cliente non specificato'}
          </h3>
        </div>

        <div className="mb-3">
          <p className="text-sm text-gray-700 font-medium">
            {getTipoLavorazioneSigla(busta.tipo_lavorazione)}
          </p>
          {paymentBadge?.sublabel && (
            <p className="text-xs text-gray-500 mt-1">{paymentBadge.sublabel}</p>
          )}
        </div>

        <div className="mb-3 flex-1">
          {displayOrders.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Nessun prodotto ordinato</p>
          ) : (
            <div className="space-y-2">
              {ordiniOrdinati.slice(0, 3).map((ordine) => {
                const isCancelled = (ordine.stato || '').toLowerCase() === 'annullato';
                const descrizioneBreve = ordine.descrizione_prodotto.length > 50
                  ? `${ordine.descrizione_prodotto.substring(0, 50)}...`
                  : ordine.descrizione_prodotto;
                const availabilityStatus = (ordine.stato_disponibilita || 'disponibile') as AvailabilityStatus;
                const orderAvailability = AVAILABILITY_BADGE[availabilityStatus];
                const orderReminder = parseDateSafe(ordine.promemoria_disponibilita);
                const orderReminderLabel = orderReminder
                  ? orderReminder.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
                  : null;
                const orderReminderDue = orderReminder ? orderReminder.getTime() <= Date.now() : false;

                return (
                  <div key={ordine.id} className="flex items-start gap-2">
                    <span className={`text-sm flex-shrink-0 mt-0.5 ${isCancelled ? 'text-gray-400' : ''}`}>
                      {getStatoOrdineEmoji(ordine.stato)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs leading-tight ${isCancelled ? 'text-gray-400' : 'text-gray-900'}`}
                        title={ordine.descrizione_prodotto}
                      >
                        {descrizioneBreve}
                      </p>
                      {showAvailabilityBadge && (
                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] ${orderAvailability.className}`}
                          >
                            {orderAvailability.label}
                          </span>
                          {orderReminderLabel && (
                            <span className={`text-[10px] ${orderReminderDue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                              {orderReminderDue ? 'Scad.' : 'Check'} {orderReminderLabel}
                            </span>
                          )}
                        </div>
                      )}
                      {ordine.note && (
                        <p
                          className={`text-xs italic mt-1 ${isCancelled ? 'text-gray-300' : 'text-gray-500'}`}
                          title={ordine.note}
                        >
                          "
                          {ordine.note.length > 30 ? `${ordine.note.substring(0, 30)}...` : ordine.note}
                          "
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              {displayOrders.length > 3 && (
                <p className="text-xs text-gray-500 italic pl-6">
                  +{displayOrders.length - 3} altri prodotti...
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mt-auto pt-2 border-t border-gray-100">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="h-3 w-3" />
            <span>{daysOpen} giorni</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {displayOrders.length > 0 && <span>{displayOrders.length} prodott{displayOrders.length === 1 ? 'o' : 'i'}</span>}
            {normalizedPlanType !== 'none' && (
              <span className="flex items-center gap-1">
                <Euro className="h-3 w-3" />
                {paymentData.outstanding > 0.5 ? `Residuo ${formatCurrency(paymentData.outstanding)}` : 'Saldo ok'}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
