'use client';

import { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import PaymentPlanSetup from '../PaymentPlanSetup';
import { mutate } from 'swr';
import { useUser } from '@/context/UserContext';
import {
  AlertCircle,
  AlertTriangle,
  BellOff,
  Bot,
  Calendar,
  CreditCard,
  RefreshCw,
  Trash2,
  User as UserIcon,
  Sparkles,
  Clock,
  CheckCircle
} from 'lucide-react';

const currencyFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2
});

const paymentTypeLabels: Record<string, { title: string; description: string }> = {
  saldo_unico: {
    title: '💳 Saldo Unico',
    description: 'Incasso completo alla consegna'
  },
  installments: {
    title: '📊 Rateizzazione Interna',
    description: '2 o 3 rate gestite internamente'
  },
  finanziamento_bancario: {
    title: '🏦 Finanziamento Bancario',
    description: 'Pagamento gestito dalla banca'
  }
};

const reminderPreferenceLabels: Record<string, { title: string; hint: string; icon: JSX.Element }> = {
  automatic: {
    title: 'Automatici',
    hint: 'Messaggi dopo 3 e 10 giorni dalla scadenza',
    icon: <Bot className="w-4 h-4 mr-1 text-blue-600" />
  },
  manual: {
    title: 'Solo Manuali',
    hint: 'Il team decide quando inviare i promemoria',
    icon: <UserIcon className="w-4 h-4 mr-1 text-orange-600" />
  },
  disabled: {
    title: 'Disattivati',
    hint: 'Nessun promemoria previsto',
    icon: <BellOff className="w-4 h-4 mr-1 text-gray-500" />
  }
};

type PaymentPlanRecord = Database['public']['Tables']['payment_plans']['Row'] & {
  payment_installments: Database['public']['Tables']['payment_installments']['Row'][] | null;
};

type PaymentInstallmentRecord = Database['public']['Tables']['payment_installments']['Row'];

type InfoPagamentoRecord = Pick<
  Database['public']['Tables']['info_pagamenti']['Row'],
  'is_saldato' | 'modalita_saldo' | 'importo_acconto' | 'ha_acconto' | 'prezzo_finale' | 'updated_at' | 'data_saldo'
> & {
  note_pagamento?: string | null;
};

type BustaDettagliata = Database['public']['Tables']['buste']['Row'] & {
  clienti: Database['public']['Tables']['clienti']['Row'] | null;
  payment_plan?: PaymentPlanRecord | null;
  info_pagamenti?: InfoPagamentoRecord | null;
};

interface PagamentoTabProps {
  busta: BustaDettagliata;
  isReadOnly?: boolean;
}

interface DerivedFinance {
  totalAmount: number;
  acconto: number;
  paidInstallments: number;
  outstanding: number;
  paidCount: number;
  totalInstallments: number;
  nextInstallment: PaymentInstallmentRecord | null;
}

const formatCurrency = (value: number | null | undefined) => currencyFormatter.format(value || 0);

const computeFinanceSnapshot = (
  plan: PaymentPlanRecord | null,
  installments: PaymentInstallmentRecord[],
  info: InfoPagamentoRecord | null
): DerivedFinance => {
  const totalAmount = plan?.total_amount ?? info?.prezzo_finale ?? 0;
  const acconto = plan?.acconto ?? info?.importo_acconto ?? 0;
  const paidInstallments = installments.reduce((sum, installment) => {
    return sum + (installment.paid_amount || 0);
  }, 0);

  const outstandingRaw = totalAmount - (acconto + paidInstallments);
  const outstanding = Number.isFinite(outstandingRaw) ? Math.max(outstandingRaw, 0) : 0;

  const sortedInstallments = [...installments].sort((a, b) =>
    new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  );

  const nextInstallment = sortedInstallments.find(inst => !inst.is_completed) || null;

  return {
    totalAmount,
    acconto,
    paidInstallments,
    outstanding,
    paidCount: installments.filter(inst => inst.is_completed).length,
    totalInstallments: installments.length,
    nextInstallment
  };
};

const getInstallmentStatus = (installment: PaymentInstallmentRecord) => {
  if (installment.is_completed) {
    return {
      label: 'Pagata',
      tone: 'text-green-700 bg-green-50 border-green-200'
    };
  }

  const today = new Date();
  const dueDate = new Date(installment.due_date);
  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: `In ritardo di ${Math.abs(diffDays)} gg`,
      tone: 'text-red-700 bg-red-50 border-red-200'
    };
  }

  if (diffDays <= 3) {
    return {
      label: diffDays === 0 ? 'Scade oggi' : `Scade tra ${diffDays} gg`,
      tone: 'text-orange-700 bg-orange-50 border-orange-200'
    };
  }

  return {
    label: `Scadenza ${dueDate.toLocaleDateString('it-IT')}`,
    tone: 'text-blue-700 bg-blue-50 border-blue-200'
  };
};

const mapReminderPreferenceToBoolean = (preference: string | null) => preference === 'automatic';

export default function PagamentoTab({ busta, isReadOnly = false }: PagamentoTabProps) {
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { profile } = useUser();
  const canEdit = !isReadOnly && profile?.role !== 'operatore';

  const [isLoading, setIsLoading] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlanRecord | null>(busta.payment_plan ?? null);
  const [installments, setInstallments] = useState<PaymentInstallmentRecord[]>(
    busta.payment_plan?.payment_installments ?? []
  );
  const [infoPagamento, setInfoPagamento] = useState<InfoPagamentoRecord | null>(busta.info_pagamenti ?? null);
  const [totalDraft, setTotalDraft] = useState(() => {
    const initialTotal = busta.payment_plan?.total_amount ?? busta.info_pagamenti?.prezzo_finale ?? '';
    return initialTotal === '' ? '' : String(initialTotal ?? '');
  });
  const [isSavingTotal, setIsSavingTotal] = useState(false);
  const [ongoingAction, setOngoingAction] = useState<string | null>(null);

  // Partial payment restructure state
  const [restructureModal, setRestructureModal] = useState<{
    isOpen: boolean;
    installment: PaymentInstallmentRecord | null;
    paidAmount: number;
    remainingAmount: number;
    newInstallmentsCount: number;
  }>({
    isOpen: false,
    installment: null,
    paidAmount: 0,
    remainingAmount: 0,
    newInstallmentsCount: 2
  });

  const financeSnapshot = useMemo(
    () => computeFinanceSnapshot(paymentPlan, installments, infoPagamento),
    [paymentPlan, installments, infoPagamento]
  );

  const paymentTypeLabel = paymentPlan ? paymentTypeLabels[paymentPlan.payment_type] : null;
  const reminderPreferenceLabel = paymentPlan
    ? reminderPreferenceLabels[paymentPlan.reminder_preference || 'disabled']
    : null;
  const noPaymentRequired = useMemo(() => infoPagamento?.note_pagamento === 'NESSUN_INCASSO', [infoPagamento?.note_pagamento]);

  useEffect(() => {
    loadPaymentContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busta.id]);

  const fetchPaymentPlan = async () => {
    const { data: planData, error: planError } = await supabase
      .from('payment_plans')
      .select('*, payment_installments(*)')
      .eq('busta_id', busta.id)
      .maybeSingle();

    if (planError && planError.code !== 'PGRST116') {
      throw planError;
    }

    return planData;
  };

  const fetchPaymentInfo = async () => {
    const { data: infoData, error: infoError } = await supabase
      .from('info_pagamenti')
      .select('is_saldato, modalita_saldo, note_pagamento, importo_acconto, ha_acconto, prezzo_finale, data_saldo, updated_at')
      .eq('busta_id', busta.id)
      .maybeSingle();

    if (infoError && infoError.code !== 'PGRST116') {
      throw infoError;
    }

    return infoData;
  };

  const syncAccontoWithPlan = async (planData: any, infoData: any) => {
    if (planData && infoData && typeof infoData.importo_acconto === 'number') {
      const delta = Math.abs((planData.acconto || 0) - infoData.importo_acconto);
      if (delta > 0.49) {
        await callPaymentsAction('sync_plan_acconto', {
          paymentPlanId: planData.id,
          acconto: infoData.importo_acconto
        });
        planData.acconto = infoData.importo_acconto;
      }
    }
  };

  const updateStateFromData = (planData: any, infoData: any) => {
    setPaymentPlan(planData ?? null);
    setInstallments(planData?.payment_installments ?? []);
    setInfoPagamento(infoData ?? null);

    if (planData?.total_amount) {
      setTotalDraft(String(planData.total_amount));
    } else if (infoData?.prezzo_finale) {
      setTotalDraft(String(infoData.prezzo_finale));
    }
  };

  const loadPaymentContext = async () => {
    setIsLoading(true);
    try {
      const planData = await fetchPaymentPlan();
      const infoData = await fetchPaymentInfo();
      await syncAccontoWithPlan(planData, infoData);
      updateStateFromData(planData, infoData);
    } catch (error) {
      console.error('❌ Error loading payment context:', error);
    } finally {
      setIsLoading(false);
    }
  };

  type PaymentsActionResponse = {
    success?: boolean;
    error?: string;
    [key: string]: any;
  };

  const callPaymentsAction = async (action: string, payload: Record<string, any>) => {
    const response = await fetch('/api/payments/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload })
    });

    const result: PaymentsActionResponse = await response
      .json()
      .catch(() => ({} as PaymentsActionResponse));

    if (!response.ok || !result?.success) {
      throw new Error(result?.error || 'Operazione pagamento non riuscita');
    }

    return result;
  };

  const handlePlanCreated = async () => {
    setIsSetupOpen(false);
    await loadPaymentContext();
    await mutate('/api/buste');
  };

  const handleResetPlan = async () => {
    if (!paymentPlan) return;
    if (!confirm('Eliminare il piano pagamenti? Verranno rimosse anche le rate associate.')) {
      return;
    }

    setOngoingAction('reset-plan');
    try {
      await callPaymentsAction('delete_plan', { paymentPlanId: paymentPlan.id });

      setPaymentPlan(null);
      setInstallments([]);
      await mutate('/api/buste');
    } catch (error: any) {
      console.error('❌ Error deleting payment plan:', error);
      alert(`Errore nella cancellazione del piano: ${error.message}`);
    } finally {
      setOngoingAction(null);
    }
  };

  const validateTotalAmount = (draft: string) => {
    if (!canEdit || draft === '') return null;

    const parsed = Number.parseFloat(draft);
    if (!Number.isFinite(parsed) || parsed < 0) {
      alert('Inserisci un totale valido prima di salvare.');
      return null;
    }

    return parsed;
  };

  const saveTotalAmount = async () => {
    const validAmount = validateTotalAmount(totalDraft);
    if (validAmount === null) return;

    setIsSavingTotal(true);
    try {
      await callPaymentsAction('update_total', {
        bustaId: busta.id,
        paymentPlanId: paymentPlan?.id,
        totalAmount: validAmount
      });
      await loadPaymentContext();
      await mutate('/api/buste');
    } catch (error: any) {
      console.error('❌ Error saving total amount:', error);
      alert(`Errore salvataggio totale: ${error.message}`);
    } finally {
      setIsSavingTotal(false);
    }
  };

  const handleMarkNoPayment = async () => {
    if (!canEdit) return;
    if (!confirm('Segnare questa busta come senza incasso? Verrà registrata come lavorazione gratuita.')) {
      return;
    }

    setOngoingAction('mark-no-payment');
    try {
      if (paymentPlan) {
        await callPaymentsAction('delete_plan', { paymentPlanId: paymentPlan.id });
      }

      const response = await fetch('/api/buste/no-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bustaId: busta.id }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Impossibile segnare la busta come gratuita');
      }

      setTotalDraft('0');
      await loadPaymentContext();
      await mutate('/api/buste');
    } catch (error: any) {
      console.error('❌ Error marking no payment:', error);
      alert(`Errore configurazione senza incasso: ${error.message}`);
    } finally {
      setOngoingAction(null);
    }
  };

  const handleClearNoPayment = async () => {
    if (!canEdit || !noPaymentRequired) return;
    if (!confirm('Ripristinare la gestione pagamenti standard per questa busta?')) {
      return;
    }

    setOngoingAction('clear-no-payment');
    try {
      const response = await fetch(`/api/buste/no-payment?bustaId=${busta.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Impossibile ripristinare la gestione pagamenti');
      }

      setTotalDraft('');
      await loadPaymentContext();
      await mutate('/api/buste');
    } catch (error: any) {
      console.error('❌ Error clearing no payment flag:', error);
      alert(`Errore ripristino pagamenti: ${error.message}`);
    } finally {
      setOngoingAction(null);
    }
  };

  const promptForPaymentAmount = (installment: PaymentInstallmentRecord) => {
    const defaultValue = installment.expected_amount || 0;
    const input = prompt('Importo incassato per questa rata', defaultValue ? String(defaultValue) : '');
    if (input === null) return null; // user cancelled

    const parsed = Number.parseFloat(input);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      alert('Inserisci un importo valido per registrare il pagamento.');
      return null;
    }

    return parsed;
  };

  const updateInstallmentPayment = async (installmentId: string, amount: number, isCompleted: boolean) => {
    await callPaymentsAction('update_installment', {
      installmentId,
      amount,
      isCompleted
    });
  };

  const handleRegisterInstallmentPayment = async (installment: PaymentInstallmentRecord) => {
    if (!canEdit) return;

    const paymentAmount = promptForPaymentAmount(installment);
    if (!paymentAmount) return;

    const expectedAmount = installment.expected_amount || 0;

    // Check if this is a partial payment
    if (paymentAmount < expectedAmount - 0.01) {
      // Show restructure modal
      setRestructureModal({
        isOpen: true,
        installment,
        paidAmount: paymentAmount,
        remainingAmount: expectedAmount - paymentAmount,
        newInstallmentsCount: 2
      });
      return;
    }

    // Full payment - proceed normally
    setOngoingAction(`pay-${installment.id}`);
    try {
      await updateInstallmentPayment(installment.id, paymentAmount, true);
      await loadPaymentContext();
      await mutate('/api/buste');
    } catch (error: any) {
      console.error('❌ Error registering payment:', error);
      alert(`Errore nel salvataggio: ${error.message}`);
    } finally {
      setOngoingAction(null);
    }
  };

  const handleConfirmRestructure = async () => {
    if (!restructureModal.installment || !paymentPlan) return;

    setOngoingAction(`restructure-${restructureModal.installment.id}`);
    try {
      await callPaymentsAction('restructure_installments', {
        installmentId: restructureModal.installment.id,
        paidAmount: restructureModal.paidAmount,
        newInstallmentsCount: restructureModal.newInstallmentsCount,
        paymentPlanId: paymentPlan.id
      });

      setRestructureModal({
        isOpen: false,
        installment: null,
        paidAmount: 0,
        remainingAmount: 0,
        newInstallmentsCount: 2
      });

      await loadPaymentContext();
      await mutate('/api/buste');
      alert('Piano rate aggiornato con successo!');
    } catch (error: any) {
      console.error('❌ Error restructuring installments:', error);
      alert(`Errore nella ristrutturazione: ${error.message}`);
    } finally {
      setOngoingAction(null);
    }
  };

  const handleCancelRestructure = () => {
    setRestructureModal({
      isOpen: false,
      installment: null,
      paidAmount: 0,
      remainingAmount: 0,
      newInstallmentsCount: 2
    });
  };

  const handleUndoInstallmentPayment = async (installment: PaymentInstallmentRecord) => {
    if (!canEdit) return;
    if (!confirm('Segnare questa rata come non pagata?')) return;

    setOngoingAction(`undo-${installment.id}`);
    try {
      await updateInstallmentPayment(installment.id, 0, false);
      await loadPaymentContext();
      await mutate('/api/buste');
    } catch (error: any) {
      console.error('❌ Error reverting payment:', error);
      alert(`Errore nell\'aggiornamento: ${error.message}`);
    } finally {
      setOngoingAction(null);
    }
  };

  const handleToggleReminderPreference = async (preference: 'automatic' | 'manual' | 'disabled') => {
    if (!canEdit || !paymentPlan) return;

    setOngoingAction('toggle-reminders');
    try {
      await callPaymentsAction('toggle_reminder', {
        paymentPlanId: paymentPlan.id,
        preference
      });

      await loadPaymentContext();
    } catch (error: any) {
      console.error('❌ Error updating reminder preference:', error);
      alert(`Errore nella configurazione: ${error.message}`);
    } finally {
      setOngoingAction(null);
    }
  };

  const handleMarkPlanAsCompleted = async () => {
    if (!canEdit || !paymentPlan) return;

    setOngoingAction('complete-plan');
    try {
      await callPaymentsAction('complete_plan', {
        paymentPlanId: paymentPlan.id,
        bustaId: busta.id
      });

      await loadPaymentContext();
      await mutate('/api/buste');
    } catch (error: any) {
      console.error('❌ Error closing plan:', error);
      alert(`Errore nel completamento: ${error.message}`);
    } finally {
      setOngoingAction(null);
    }
  };

  const handleCloseBusta = async () => {
    if (!canEdit) return;
    if (!confirm('Segnare la busta come consegnata e pagata?')) return;

    setOngoingAction('close-busta');
    try {
      await callPaymentsAction('close_busta', { bustaId: busta.id });

      await mutate('/api/buste');
      await loadPaymentContext();
    } catch (error: any) {
      console.error('❌ Error closing busta:', error);
      alert(`Errore aggiornamento busta: ${error.message}`);
    } finally {
      setOngoingAction(null);
    }
  };

  const outstandingZero = financeSnapshot.outstanding <= 0.5;
  const planIsInstallments = paymentPlan?.payment_type === 'installments';

  const installmentsSorted = useMemo(
    () => [...installments].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()),
    [installments]
  );

  return (
    <div className="space-y-6">
      {isSetupOpen && (
        <PaymentPlanSetup
          busta={busta}
          totalAmount={financeSnapshot.totalAmount}
          acconto={financeSnapshot.acconto}
          onComplete={handlePlanCreated}
          onCancel={() => setIsSetupOpen(false)}
        />
      )}

      {/* Partial Payment Restructure Modal */}
      {restructureModal.isOpen && restructureModal.installment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-orange-500" />
                Pagamento Parziale
              </h3>
              <p className="text-sm text-gray-600 mt-2">
                L&apos;importo incassato è inferiore alla rata prevista. Come vuoi gestire il residuo?
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Rata prevista:</span>
                <span className="font-medium">{formatCurrency(restructureModal.installment.expected_amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Importo incassato:</span>
                <span className="font-medium text-green-700">{formatCurrency(restructureModal.paidAmount)}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-gray-600">Residuo da questa rata:</span>
                <span className="font-semibold text-orange-700">{formatCurrency(restructureModal.remainingAmount)}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                In quante rate vuole pagare il residuo?
              </label>
              <select
                value={restructureModal.newInstallmentsCount}
                onChange={(e) => setRestructureModal(prev => ({
                  ...prev,
                  newInstallmentsCount: parseInt(e.target.value, 10)
                }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
              >
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'rata' : 'rate'} - {formatCurrency(restructureModal.remainingAmount / n)} {n === 1 ? '' : 'ciascuna'}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-2">
                Le nuove rate saranno programmate a distanza di un mese l&apos;una dall&apos;altra, a partire da oggi.
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={handleCancelRestructure}
                disabled={ongoingAction?.startsWith('restructure-')}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={handleConfirmRestructure}
                disabled={ongoingAction?.startsWith('restructure-')}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {ongoingAction?.startsWith('restructure-') ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin inline" />
                    Salvataggio...
                  </>
                ) : (
                  'Conferma e crea nuove rate'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Stato Pagamenti</h2>
              <p className="text-sm text-gray-500">Gestione incassi per la busta #{busta.readable_id}</p>
            </div>
          </div>
          {canEdit && (
            <div className="flex items-center space-x-2">
              {paymentPlan ? (
                <button
                  onClick={() => setIsSetupOpen(true)}
                  className="px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
                >
                  Rivedi piano
                </button>
              ) : (
                <button
                  onClick={() => setIsSetupOpen(true)}
                  disabled={noPaymentRequired}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  title={noPaymentRequired ? 'Ripristina la gestione pagamenti per creare un piano' : undefined}
                >
                  Configura piano
                </button>
              )}
              {paymentPlan && (
                <button
                  onClick={handleResetPlan}
                  disabled={ongoingAction === 'reset-plan'}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4 inline mr-1" />
                  Reset
                </button>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-xs uppercase text-gray-500">Totale preventivato</div>
              <div className="flex items-baseline space-x-2 mt-2">
                <span className="text-xl font-semibold text-gray-900">{formatCurrency(financeSnapshot.totalAmount)}</span>
              </div>
              {canEdit && (
                <div className="mt-3 space-y-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={totalDraft}
                    onChange={(event) => setTotalDraft(event.target.value)}
                    disabled={noPaymentRequired}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60 disabled:bg-gray-100"
                    placeholder="Es. 550"
                  />
                  <button
                    onClick={saveTotalAmount}
                    disabled={isSavingTotal || totalDraft === '' || noPaymentRequired}
                    className="w-full text-sm bg-blue-600 text-white rounded-md py-1.5 hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isSavingTotal ? 'Salvataggio...' : 'Salva totale'}
                  </button>
                  {noPaymentRequired && (
                    <p className="text-xs text-gray-500">
                      Nessun incasso previsto: ripristina la gestione pagamenti per modificare il totale.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-xs uppercase text-gray-500">Acconto incassato</div>
              <div className="mt-2 text-xl font-semibold text-green-700">
                {formatCurrency(financeSnapshot.acconto)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Gestisci l'acconto dalla scheda Materiali</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-xs uppercase text-gray-500">Incassato sulle rate</div>
              <div className="mt-2 text-xl font-semibold text-blue-700">
                {formatCurrency(financeSnapshot.paidInstallments)}
              </div>
              {planIsInstallments && (
                <p className="text-xs text-gray-500 mt-1">
                  {financeSnapshot.paidCount} di {financeSnapshot.totalInstallments} rate saldate
                </p>
              )}
            </div>

            <div className={`rounded-lg p-4 border ${outstandingZero ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
              <div className="text-xs uppercase text-gray-500">Da incassare</div>
              <div className={`mt-2 text-xl font-semibold ${outstandingZero ? 'text-green-700' : 'text-orange-700'}`}>
                {formatCurrency(financeSnapshot.outstanding)}
              </div>
              {financeSnapshot.nextInstallment && !outstandingZero && (
                <p className="text-xs text-gray-600 mt-1 flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  Prossima rata {new Date(financeSnapshot.nextInstallment.due_date).toLocaleDateString('it-IT')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 flex items-center justify-center text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          Caricamento stato pagamenti...
        </div>
      ) : paymentPlan ? (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">Tipo pagamento</div>
              <div className="text-base text-gray-700">
                {paymentTypeLabel?.title}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {paymentTypeLabel?.description}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                paymentPlan.is_completed ? 'bg-green-50 text-green-700 border border-green-200' :
                outstandingZero ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                'bg-orange-50 text-orange-700 border border-orange-200'
              }`}>
                {paymentPlan.is_completed
                  ? '✅ Piano completato'
                  : outstandingZero
                    ? 'Saldo pronto per chiusura'
                    : 'Saldo in corso'}
              </div>
              {canEdit && !paymentPlan.is_completed && paymentPlan.payment_type !== 'installments' && (
                <button
                  onClick={handleMarkPlanAsCompleted}
                  disabled={ongoingAction === 'complete-plan'}
                  className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  Segna incassato
                </button>
              )}
            </div>
          </div>

          {planIsInstallments && (
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900 flex items-center">
                    <Sparkles className="w-4 h-4 mr-2 text-purple-500" />
                    Promemoria rate
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Mantieni i clienti aggiornati: invio dopo 3 e 10 giorni dalla scadenza per ogni rata non pagata.
                  </p>
                </div>

                {canEdit && (
                  <div className="flex items-center space-x-2">
                    {(['automatic', 'manual', 'disabled'] as const).map(option => (
                      <button
                        key={option}
                        onClick={() => handleToggleReminderPreference(option)}
                        disabled={ongoingAction === 'toggle-reminders'}
                        className={`px-3 py-1.5 text-xs rounded-full border transition-colors flex items-center ${
                          paymentPlan.reminder_preference === option
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {reminderPreferenceLabels[option].icon}
                        {reminderPreferenceLabels[option].title}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-3 text-xs text-gray-500 flex items-center">
                {reminderPreferenceLabel?.icon}
                <span>{reminderPreferenceLabel?.hint}</span>
              </div>
            </div>
          )}

          {installmentsSorted.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {installmentsSorted.map((installment, index) => {
                const status = getInstallmentStatus(installment);
                const reminderInfo = planIsInstallments ? `3g: ${installment.reminder_3_days_sent ? '✅' : '—'}   ·   10g: ${installment.reminder_10_days_sent ? '✅' : '—'}` : null;
                const isProcessing = ongoingAction === `pay-${installment.id}` || ongoingAction === `undo-${installment.id}`;

                return (
                  <div key={installment.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="text-sm font-semibold text-gray-900">Rata {index + 1}</div>
                        <span className={`text-xs px-2 py-1 rounded-full border ${status.tone}`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2 text-sm text-gray-700">
                        <div>
                          <div className="text-xs uppercase text-gray-500">Scadenza</div>
                          <div className="flex items-center text-gray-700">
                            <Calendar className="w-4 h-4 mr-1" />
                            {new Date(installment.due_date).toLocaleDateString('it-IT')}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs uppercase text-gray-500">Previsto</div>
                          <div>{formatCurrency(installment.expected_amount)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase text-gray-500">Incassato</div>
                          <div className="text-green-700">{formatCurrency(installment.paid_amount)}</div>
                        </div>
                      </div>
                      {planIsInstallments && reminderInfo && (
                        <div className="mt-2 text-xs text-gray-500 flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          Stato reminder: {reminderInfo}
                        </div>
                      )}
                    </div>

                    {canEdit && (
                      <div className="flex items-center space-x-2">
                        {installment.is_completed ? (
                          <button
                            onClick={() => handleUndoInstallmentPayment(installment)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
                          >
                            Annulla pagamento
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRegisterInstallmentPayment(installment)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            Registra pagamento
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-6 py-5 bg-gray-50 text-gray-500 text-sm flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              Nessuna rata pianificata per questo piano.
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-500 space-y-4">
          {noPaymentRequired ? (
            <>
              <CheckCircle className="w-6 h-6 mx-auto text-green-500" />
              <div>
                <p className="text-sm font-medium text-gray-700">Nessun incasso previsto per questa busta.</p>
                <p className="text-xs text-gray-500 mt-1">
                  È stata registrata come lavorazione gratuita. Puoi chiudere la pratica senza inserire pagamenti.
                </p>
              </div>
              {canEdit && (
                <button
                  onClick={handleClearNoPayment}
                  disabled={ongoingAction === 'clear-no-payment'}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  Ripristina gestione pagamenti
                </button>
              )}
            </>
          ) : (
            <>
              <AlertTriangle className="w-6 h-6 mx-auto text-orange-500" />
              <p className="text-sm">
                Nessun piano pagamenti configurato. Imposta il totale del lavoro e scegli la modalità di incasso per attivare promemoria e stato in kanban.
              </p>
              {canEdit && (
                <div className="flex flex-col sm:flex-row gap-2 mt-2 justify-center">
                  <button
                    onClick={() => setIsSetupOpen(true)}
                    className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Crea nuovo piano
                  </button>
                  <button
                    onClick={handleMarkNoPayment}
                    disabled={ongoingAction === 'mark-no-payment'}
                    className="inline-flex items-center justify-center px-4 py-2 border border-blue-200 text-blue-700 rounded-md text-sm hover:bg-blue-50 transition-colors disabled:opacity-50"
                  >
                    Segna come senza incasso
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {canEdit && outstandingZero && paymentPlan && !paymentPlan.is_completed && paymentPlan.payment_type === 'installments' && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-5 py-4 flex items-center justify-between">
          <div className="text-sm">
            Tutte le rate risultano pagate. Vuoi segnare il piano come completato e aggiornare le statistiche?
          </div>
          <button
            onClick={handleMarkPlanAsCompleted}
            disabled={ongoingAction === 'complete-plan'}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            Completa piano
          </button>
        </div>
      )}

      {canEdit && outstandingZero && (paymentPlan?.is_completed || noPaymentRequired) && busta.stato_attuale !== 'consegnato_pagato' && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-5 py-4 flex items-center justify-between">
          <div className="text-sm font-medium">
            {noPaymentRequired
              ? 'Nessun incasso previsto: la busta può essere spostata su "Consegnato & Pagato".'
              : 'Pagamenti in regola. La busta può essere spostata su "Consegnato & Pagato".'}
          </div>
          <button
            onClick={handleCloseBusta}
            disabled={ongoingAction === 'close-busta'}
            className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            Chiudi busta
          </button>
        </div>
      )}
    </div>
  );
}
