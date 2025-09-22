'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import {
  Euro,
  Calendar,
  Plus,
  Minus,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Bot,
  User,
  BellOff
} from 'lucide-react';

interface PaymentPlanSetupProps {
  busta: any;
  totalAmount: number;
  acconto: number;
  onComplete: (plan: any) => void;
  onCancel: () => void;
}

type PaymentType = 'saldo_unico' | 'installments' | 'finanziamento_bancario';
type ReminderPreference = 'automatic' | 'manual' | 'disabled';

interface Installment {
  id: string;
  amount: string;
  dueDate: string;
}

export default function PaymentPlanSetup({
  busta,
  totalAmount,
  acconto,
  onComplete,
  onCancel
}: PaymentPlanSetupProps) {
  const [paymentType, setPaymentType] = useState<PaymentType>('saldo_unico');
  const [reminderPreference, setReminderPreference] = useState<ReminderPreference>('automatic');
  const [installments, setInstallments] = useState<Installment[]>([
    { id: '1', amount: '', dueDate: '' },
    { id: '2', amount: '', dueDate: '' }
  ]);
  const [isCreating, setIsCreating] = useState(false);

  const remainingAmount = totalAmount - acconto;
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const addInstallment = () => {
    const newId = (installments.length + 1).toString();
    setInstallments([...installments, { id: newId, amount: '', dueDate: '' }]);
  };

  const removeInstallment = (id: string) => {
    if (installments.length > 2) {
      setInstallments(installments.filter(i => i.id !== id));
    }
  };

  const updateInstallment = (id: string, field: 'amount' | 'dueDate', value: string) => {
    setInstallments(installments.map(i =>
      i.id === id ? { ...i, [field]: value } : i
    ));
  };

  const getTotalInstallments = () => {
    return installments.reduce((sum, i) => sum + (Number.parseFloat(i.amount) || 0), 0);
  };

  const getBalance = () => {
    return remainingAmount - getTotalInstallments();
  };

  const isValidInstallmentPlan = () => {
    if (paymentType !== 'installments') return true;

    const hasAllAmounts = installments.every(i => i.amount && Number.parseFloat(i.amount) > 0);
    const hasAllDates = installments.every(i => i.dueDate);
    const balanceIsZero = Math.abs(getBalance()) < 0.01;

    return hasAllAmounts && hasAllDates && balanceIsZero;
  };

  const handleCreatePlan = async () => {
    if (!totalAmount || totalAmount <= 0) {
      alert('Imposta un totale valido prima di creare il piano pagamenti.');
      return;
    }

    setIsCreating(true);
    try {
      // Create payment plan
      const planData = {
        busta_id: busta.id,
        total_amount: totalAmount,
        acconto: acconto,
        payment_type: paymentType,
        auto_reminders_enabled: paymentType === 'installments' && reminderPreference === 'automatic',
        reminder_preference: paymentType === 'installments' ? reminderPreference : 'disabled',
        is_completed: paymentType === 'finanziamento_bancario'
      };

      const { data: plan, error: planError } = await supabase
        .from('payment_plans')
        .insert(planData)
        .select()
        .single();

      if (planError) throw planError;

      const modalitaSaldo = paymentType === 'saldo_unico'
        ? 'saldo_unico'
        : paymentType === 'finanziamento_bancario'
          ? 'finanziamento'
          : installments.length === 2
            ? 'due_rate'
            : 'tre_rate';

      // Create installments if needed
      if (paymentType === 'installments') {
        const installmentData = installments.map((inst, index) => ({
          payment_plan_id: plan.id,
          installment_number: index + 1,
          due_date: inst.dueDate,
          expected_amount: Number.parseFloat(inst.amount),
          paid_amount: 0,
          is_completed: false,
          reminder_3_days_sent: false,
          reminder_10_days_sent: false
        }));

        const { error: instError } = await supabase
          .from('payment_installments')
          .insert(installmentData);

        if (instError) throw instError;
      }

      // Sync legacy info_pagamenti for backwards compatibility
      const { error: infoError } = await supabase
        .from('info_pagamenti')
        .upsert({
          busta_id: busta.id,
          prezzo_finale: totalAmount,
          importo_acconto: acconto,
          ha_acconto: acconto > 0,
          modalita_saldo: modalitaSaldo,
          is_saldato: paymentType === 'finanziamento_bancario',
          data_saldo: paymentType === 'finanziamento_bancario' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'busta_id' });

      if (infoError) {
        console.warn('⚠️ Non è stato possibile sincronizzare info_pagamenti:', infoError.message);
      }

      console.log('✅ Payment plan created successfully');
      onComplete(plan);

    } catch (error: any) {
      console.error('❌ Error creating payment plan:', error);
      alert(`Errore creazione piano: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Euro className="w-6 h-6 mr-2 text-yellow-600" />
              Setup Piano Pagamenti
            </h2>
            <p className="text-sm text-gray-600 mt-1">Busta #{busta.readable_id}</p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">

          {/* Payment Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-sm text-gray-500">Totale</div>
                <div className="text-lg font-semibold">€{totalAmount.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Acconto</div>
                <div className="text-lg font-semibold text-green-600">€{acconto.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Rimanente</div>
                <div className="text-lg font-semibold text-orange-600">€{remainingAmount.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Payment Type Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Modalità di Pagamento</h3>

            {/* Saldo Unico */}
            <label
              htmlFor="payment-type-saldo"
              className={`block border rounded-lg p-4 cursor-pointer transition-colors ${
                paymentType === 'saldo_unico' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center">
                <input
                  id="payment-type-saldo"
                  type="radio"
                  name="payment-type"
                  checked={paymentType === 'saldo_unico'}
                  onChange={() => setPaymentType('saldo_unico')}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium">💳 Saldo Unico</div>
                  <div className="text-sm text-gray-600">
                    €{remainingAmount.toFixed(2)} alla consegna - Busta si chiude subito
                  </div>
                </div>
              </div>
            </label>

            {/* Installments */}
            <label
              htmlFor="payment-type-installments"
              className={`block border rounded-lg p-4 cursor-pointer transition-colors ${
                paymentType === 'installments' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center">
                <input
                  id="payment-type-installments"
                  type="radio"
                  name="payment-type"
                  checked={paymentType === 'installments'}
                  onChange={() => setPaymentType('installments')}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium">📊 Rateizzazione Interna</div>
                  <div className="text-sm text-gray-600">
                    Pagamenti dilazionati con promemoria
                  </div>
                </div>
              </div>
            </label>

            {/* Bank Financing */}
            <label
              htmlFor="payment-type-finanziamento"
              className={`block border rounded-lg p-4 cursor-pointer transition-colors ${
                paymentType === 'finanziamento_bancario' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center">
                <input
                  id="payment-type-finanziamento"
                  type="radio"
                  name="payment-type"
                  checked={paymentType === 'finanziamento_bancario'}
                  onChange={() => setPaymentType('finanziamento_bancario')}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium">🏦 Finanziamento Bancario</div>
                  <div className="text-sm text-gray-600">
                    La banca gestisce i pagamenti - Busta si chiude subito
                  </div>
                </div>
              </div>
            </label>
          </div>

          {/* Installment Details */}
          {paymentType === 'installments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-md font-medium text-gray-900">Definisci le Rate</h4>
                <button
                  onClick={addInstallment}
                  className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  <Plus className="w-4 h-4" />
                  <span>Aggiungi Rata</span>
                </button>
              </div>

              {installments.map((installment, index) => (
                <div key={installment.id} className="flex items-center space-x-3">
                  <div className="text-sm font-medium text-gray-600 w-16">
                    Rata {index + 1}
                  </div>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={installment.amount}
                      onChange={(e) => updateInstallment(installment.id, 'amount', e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 text-sm">€</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <input
                      type="date"
                      value={installment.dueDate}
                      onChange={(e) => updateInstallment(installment.id, 'dueDate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  {installments.length > 2 && (
                    <button
                      onClick={() => removeInstallment(installment.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              {/* Balance Check */}
              <div className={`p-3 rounded-lg ${
                Math.abs(getBalance()) < 0.01
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-orange-50 border border-orange-200'
              }`}>
                <div className="flex items-center space-x-2">
                  {Math.abs(getBalance()) < 0.01 ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                  )}
                  <div>
                    <div className="font-medium">
                      Totale rate: €{getTotalInstallments().toFixed(2)}
                    </div>
                    <div className="text-sm">
                      Bilanciamento: €{getBalance().toFixed(2)}
                      {Math.abs(getBalance()) < 0.01 && " ✅ Perfetto!"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Reminder Preferences */}
              <div className="space-y-3">
                <h5 className="font-medium text-gray-900">📧 Gestione Promemoria</h5>

                <div className="space-y-2">
                  <label
                    htmlFor="reminder-automatic"
                    className={`block border rounded-lg p-3 cursor-pointer ${
                      reminderPreference === 'automatic' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center">
                      <input
                        id="reminder-automatic"
                        type="radio"
                        name="reminder-preference"
                        checked={reminderPreference === 'automatic'}
                        onChange={() => setReminderPreference('automatic')}
                        className="mr-3"
                      />
                      <Bot className="w-5 h-5 mr-2 text-blue-600" />
                      <div>
                        <div className="font-medium">Automatici</div>
                        <div className="text-xs text-gray-600">
                          Inviati dopo 3 e 10 giorni dalla scadenza
                        </div>
                      </div>
                    </div>
                  </label>

                  <label
                    htmlFor="reminder-manual"
                    className={`block border rounded-lg p-3 cursor-pointer ${
                      reminderPreference === 'manual' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center">
                      <input
                        id="reminder-manual"
                        type="radio"
                        name="reminder-preference"
                        checked={reminderPreference === 'manual'}
                        onChange={() => setReminderPreference('manual')}
                        className="mr-3"
                      />
                      <User className="w-5 h-5 mr-2 text-orange-600" />
                      <div>
                        <div className="font-medium">Solo Manuali</div>
                        <div className="text-xs text-gray-600">
                          Invii tu quando vuoi
                        </div>
                      </div>
                    </div>
                  </label>

                  <label
                    htmlFor="reminder-disabled"
                    className={`block border rounded-lg p-3 cursor-pointer ${
                      reminderPreference === 'disabled' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center">
                      <input
                        id="reminder-disabled"
                        type="radio"
                        name="reminder-preference"
                        checked={reminderPreference === 'disabled'}
                        onChange={() => setReminderPreference('disabled')}
                        className="mr-3"
                      />
                      <BellOff className="w-5 h-5 mr-2 text-gray-600" />
                      <div>
                        <div className="font-medium">Nessun Promemoria</div>
                        <div className="text-xs text-gray-600">
                          Nessun invio automatico o manuale
                        </div>
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Annulla
          </button>

          <button
            onClick={handleCreatePlan}
            disabled={isCreating || (paymentType === 'installments' && !isValidInstallmentPlan())}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isCreating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Creando...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Crea Piano Pagamenti</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
