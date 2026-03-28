import { resolveSaldoUnicoMethod } from './saldoMethod'

export type PaymentBadgeInfo = {
  label: string
  className: string
  sublabel?: string
}

type PlanType = 'saldo_unico' | 'installments' | 'finanziamento_bancario' | 'no_payment' | 'none'

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount)

const normalizePlanType = (type: string | null | undefined): PlanType => {
  if (type === 'installments') return 'installments'
  if (type === 'saldo_unico') return 'saldo_unico'
  if (type === 'finanziamento_bancario') return 'finanziamento_bancario'
  if (type === 'nessun_pagamento' || type === 'no_payment') return 'no_payment'
  return 'none'
}

const mapLegacyPaymentType = (modalita: string | null | undefined): PlanType => {
  if (!modalita) return 'none'
  if (
    modalita === 'saldo_unico' ||
    modalita === 'contanti' ||
    modalita === 'pos' ||
    modalita === 'bonifico' ||
    modalita === 'paghero' ||
    modalita === 'carta'
  ) return 'saldo_unico'
  if (modalita === 'finanziamento') return 'finanziamento_bancario'
  if (modalita === 'due_rate' || modalita === 'tre_rate') return 'installments'
  if (modalita === 'nessun_pagamento') return 'no_payment'
  return 'none'
}

/**
 * Derives a payment badge for a busta using data already fetched by BUSTA_ARCHIVE_FIELDS.
 * Returns null when fully paid (no badge needed) or no payment info available.
 * No extra DB calls required.
 *
 * NOTE: PostgREST returns payment_plan as an array (isOneToOne: false on FK).
 * We normalize it here the same way the Kanban dashboard does.
 */
export function resolvePaymentBadge(busta: {
  stato_attuale?: string | null
  info_pagamenti?: {
    is_saldato?: boolean | null
    modalita_saldo?: string | null
    note_pagamento?: string | null
    prezzo_finale?: number | null
    importo_acconto?: number | null
    data_saldo?: string | null
  } | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payment_plan?: any
}): PaymentBadgeInfo | null {
  // PostgREST returns payment_plan as an array (isOneToOne: false on FK).
  // Normalize to single object the same way the Kanban dashboard does.
  const rawPlan = busta.payment_plan
  const paymentPlan: {
    id?: string | null
    total_amount?: number | null
    acconto?: number | null
    payment_type?: string | null
    is_completed?: boolean | null
    payment_installments?: Array<{
      id?: string | null
      paid_amount?: number | null
      is_completed?: boolean | null
    }> | null
  } | null = Array.isArray(rawPlan) ? (rawPlan[0] ?? null) : (rawPlan ?? null)
  const legacyInfo = busta.info_pagamenti

  const installments = (paymentPlan?.payment_installments || []).map(inst => ({
    is_completed: inst.is_completed === true,
    paid_amount: inst.paid_amount || 0,
  }))

  const totalAmount = paymentPlan?.total_amount ?? legacyInfo?.prezzo_finale ?? 0
  const acconto = paymentPlan?.acconto ?? legacyInfo?.importo_acconto ?? 0
  const paidInstallmentsAmount = installments.reduce((sum, inst) => sum + inst.paid_amount, 0)
  const paidCount = installments.filter(inst => inst.is_completed).length
  const totalInstallments = installments.length
  const planCompleted = paymentPlan?.is_completed ?? (legacyInfo?.is_saldato === true)
  const outstandingRaw = totalAmount - Math.max(acconto, 0) - paidInstallmentsAmount
  const outstanding = planCompleted ? 0 : Math.max(outstandingRaw, 0)

  const saldoMethod = resolveSaldoUnicoMethod({
    modalitaSaldo: legacyInfo?.modalita_saldo,
    notePagamento: legacyInfo?.note_pagamento,
  }) || legacyInfo?.modalita_saldo || null

  let planType: PlanType = paymentPlan
    ? normalizePlanType(paymentPlan.payment_type)
    : mapLegacyPaymentType(legacyInfo?.modalita_saldo)

  const noteMarksNoPayment = legacyInfo?.note_pagamento === 'NESSUN_INCASSO'
  const zeroBalanceClosed = !paymentPlan && (legacyInfo?.is_saldato ?? false) && (totalAmount ?? 0) <= 0.5

  if (!paymentPlan && (noteMarksNoPayment || zeroBalanceClosed)) {
    planType = 'no_payment'
  }

  const hasInstallmentsPlan = planType === 'installments' && totalInstallments > 0 && totalAmount > 0
  const hasSaldoPlan = planType === 'saldo_unico' && totalAmount > 0
  const hasFinancingPlan = planType === 'finanziamento_bancario' && totalAmount > 0
  const hasNoPaymentPlan = planType === 'no_payment'

  if (!(hasInstallmentsPlan || hasSaldoPlan || hasFinancingPlan || hasNoPaymentPlan)) {
    planType = 'none'
  }

  // installments
  if (planType === 'installments' && totalInstallments > 0) {
    const allPaid = planCompleted || outstanding <= 0.5
    if (allPaid) return null // fully paid, no badge needed in search
    const nextInstallmentNumber = Math.min(totalInstallments, Math.max(paidCount + 1, 1))
    return {
      label: `Rata ${nextInstallmentNumber}/${totalInstallments}`,
      className: 'bg-orange-50 text-orange-700 border border-orange-200',
      sublabel: outstanding > 0.5 ? `Residuo ${formatCurrency(outstanding)}` : undefined,
    }
  }

  // saldo unico
  if (planType === 'saldo_unico') {
    const deferredPending = (saldoMethod === 'bonifico' || saldoMethod === 'paghero') && !planCompleted
    if (deferredPending) {
      return {
        label: saldoMethod === 'paghero' ? 'PAGHERÒ' : 'BONIFICO',
        className: 'bg-amber-50 text-amber-700 border border-amber-200',
        sublabel: outstanding > 0.5 ? `Da incassare ${formatCurrency(outstanding)}` : 'In attesa incasso',
      }
    }
    // fully paid saldo unico — no badge needed
    return null
  }

  // finanziamento
  if (planType === 'finanziamento_bancario') {
    return {
      label: 'FINANZIAMENTO',
      className: 'bg-blue-50 text-blue-700 border border-blue-200',
      sublabel: totalAmount > 0 ? `Totale ${formatCurrency(totalAmount)}` : undefined,
    }
  }

  return null
}
