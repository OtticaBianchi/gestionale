import { Database } from '@/types/database.types'

type BustaRow = Database['public']['Tables']['buste']['Row']
type OrdineRow = Pick<Database['public']['Tables']['ordini_materiali']['Row'], 'stato'>
export type InfoPagamenti = {
  is_saldato?: boolean | null
  modalita_saldo?: string | null
  note_pagamento?: string | null
  prezzo_finale?: number | null
  importo_acconto?: number | null
  data_saldo?: string | null
  updated_at?: string | null
}
export type PaymentInstallment = Partial<Pick<
  Database['public']['Tables']['payment_installments']['Row'],
  'paid_amount' | 'is_completed' | 'updated_at'
>>
export type PaymentPlan = Partial<Pick<
  Database['public']['Tables']['payment_plans']['Row'],
  'total_amount' | 'acconto' | 'payment_type' | 'is_completed' | 'updated_at' | 'created_at'
>> & {
  payment_installments?: (PaymentInstallment | null)[] | null
}

const CANCELLED_STATE = 'annullato'
const FINAL_STATE = 'consegnato_pagato'
const ONE_DAY_MS = 24 * 60 * 60 * 1000

const normalizeState = (value: string | null | undefined): string =>
  (value ?? '').toLowerCase()

const normalizePlanType = (
  type: string | null | undefined
): 'saldo_unico' | 'installments' | 'finanziamento_bancario' | 'no_payment' | 'none' => {
  if (type === 'saldo_unico') return 'saldo_unico'
  if (type === 'installments') return 'installments'
  if (type === 'finanziamento_bancario') return 'finanziamento_bancario'
  if (type === 'nessun_pagamento' || type === 'no_payment') return 'no_payment'
  return 'none'
}

const mapLegacyPaymentType = (
  modalita: string | null | undefined
): 'saldo_unico' | 'installments' | 'finanziamento_bancario' | 'no_payment' | 'none' => {
  if (!modalita) return 'none'
  if (modalita === 'saldo_unico') return 'saldo_unico'
  if (modalita === 'contanti' || modalita === 'pos' || modalita === 'bonifico' || modalita === 'paghero' || modalita === 'carta') {
    return 'saldo_unico'
  }
  if (modalita === 'finanziamento') return 'finanziamento_bancario'
  if (modalita === 'due_rate' || modalita === 'tre_rate') return 'installments'
  if (modalita === 'nessun_pagamento') return 'no_payment'
  return 'none'
}

const parseDateSafe = (value: string | null | undefined): Date | null => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const maxDate = (dates: (Date | null | undefined)[]): Date | null => {
  const valid = dates.filter((date): date is Date => Boolean(date))
  if (valid.length === 0) return null
  return valid.reduce((max, current) => (current > max ? current : max))
}

export type PaymentPlanType = 'saldo_unico' | 'installments' | 'finanziamento_bancario' | 'no_payment' | 'none'

// Estrae solo la modalità di pagamento (senza calcolare la data di completamento),
// riusando la stessa logica di getPaymentCompletedAt — utile per report/raggruppamenti
// dove serve sapere "come" è stato pagato, non "quando".
export const resolvePaymentPlanType = (params: {
  payment_plan?: PaymentPlan | null
  info_pagamenti?: InfoPagamenti | null
}): PaymentPlanType => {
  const paymentPlan = params.payment_plan ?? null
  const legacyInfo = params.info_pagamenti ?? null
  const totalAmount = paymentPlan?.total_amount ?? legacyInfo?.prezzo_finale ?? 0

  let planType = paymentPlan
    ? normalizePlanType(paymentPlan.payment_type)
    : mapLegacyPaymentType(legacyInfo?.modalita_saldo)

  const noteMarksNoPayment = legacyInfo?.note_pagamento === 'NESSUN_INCASSO'
  const zeroBalanceClosed = !paymentPlan && (legacyInfo?.is_saldato ?? false) && (totalAmount ?? 0) <= 0.5

  if (!paymentPlan && (noteMarksNoPayment || zeroBalanceClosed)) {
    planType = 'no_payment'
  }

  return planType
}

export const getPaymentCompletedAt = (params: {
  payment_plan?: PaymentPlan | null
  info_pagamenti?: InfoPagamenti | null
}): Date | null => {
  const paymentPlan = params.payment_plan ?? null
  const legacyInfo = params.info_pagamenti ?? null
  const installments = (paymentPlan?.payment_installments || []).filter(Boolean) as NonNullable<PaymentPlan['payment_installments']>

  const totalAmount = paymentPlan?.total_amount ?? legacyInfo?.prezzo_finale ?? 0
  const acconto = paymentPlan?.acconto ?? legacyInfo?.importo_acconto ?? 0
  const paidInstallmentsAmount = installments.reduce((sum, inst) => sum + (inst?.paid_amount || 0), 0)
  const planCompleted = paymentPlan?.is_completed ?? (legacyInfo?.is_saldato === true)
  const outstandingRaw = totalAmount - Math.max(acconto || 0, 0) - paidInstallmentsAmount
  const outstanding = planCompleted ? 0 : Math.max(outstandingRaw, 0)

  let planType = paymentPlan
    ? normalizePlanType(paymentPlan.payment_type)
    : mapLegacyPaymentType(legacyInfo?.modalita_saldo)

  const noteMarksNoPayment = legacyInfo?.note_pagamento === 'NESSUN_INCASSO'
  const zeroBalanceClosed = !paymentPlan && (legacyInfo?.is_saldato ?? false) && (totalAmount ?? 0) <= 0.5

  if (!paymentPlan && (noteMarksNoPayment || zeroBalanceClosed)) {
    planType = 'no_payment'
  }

  if (planType === 'finanziamento_bancario') {
    return (
      parseDateSafe(paymentPlan?.updated_at) ||
      parseDateSafe(paymentPlan?.created_at) ||
      parseDateSafe(legacyInfo?.updated_at)
    )
  }

  if (planType === 'installments') {
    const allInstallmentsCompleted = installments.length > 0 && installments.every(inst => inst?.is_completed === true)
    if (!planCompleted && !allInstallmentsCompleted) {
      return null
    }
    const completedInstallments = installments.filter(inst => inst?.is_completed === true)
    const lastInstallmentUpdate = maxDate(
      completedInstallments.map(inst => parseDateSafe(inst?.updated_at || null))
    )
    return (
      lastInstallmentUpdate ||
      parseDateSafe(paymentPlan?.updated_at) ||
      parseDateSafe(legacyInfo?.updated_at)
    )
  }

  if (planType === 'saldo_unico') {
    if (legacyInfo?.data_saldo) {
      return parseDateSafe(legacyInfo.data_saldo)
    }
    if (legacyInfo?.is_saldato) {
      return parseDateSafe(legacyInfo.updated_at) || parseDateSafe(paymentPlan?.updated_at)
    }
    if (paymentPlan?.is_completed) {
      return parseDateSafe(paymentPlan.updated_at)
    }
    return null
  }

  if (planType === 'no_payment') {
    return parseDateSafe(legacyInfo?.updated_at) || parseDateSafe(paymentPlan?.updated_at)
  }

  return null
}

export const areAllOrdersCancelled = (orders?: (OrdineRow | null)[] | null): boolean => {
  if (!orders || orders.length === 0) return false
  return orders.every(order => normalizeState(order?.stato) === CANCELLED_STATE)
}

export const hasActiveOrders = (orders?: (OrdineRow | null)[] | null): boolean => {
  if (!orders || orders.length === 0) return false
  return orders.some(order => normalizeState(order?.stato) !== CANCELLED_STATE)
}

export const isOrdineAnnullato = (order?: Pick<OrdineRow, 'stato'> | null): boolean =>
  normalizeState(order?.stato) === CANCELLED_STATE

export const filterOrdiniAttivi = <T extends Pick<OrdineRow, 'stato'>>(orders: T[]): T[] =>
  orders.filter(order => !isOrdineAnnullato(order))

// I 3 stati Kanban che l'auto-advance basato sugli ordini materiali può leggere/scrivere.
// Una busta già oltre materiali_arrivati (in_lavorazione, pronto_ritiro, consegnato_pagato)
// non va mai toccata da qui, anche se uno dei suoi ordini viene modificato più tardi.
export type MaterialiAutoAdvanceState = 'nuove' | 'materiali_ordinati' | 'materiali_arrivati'
export const MANAGED_MATERIALI_WORKFLOW_STATES: readonly MaterialiAutoAdvanceState[] =
  ['nuove', 'materiali_ordinati', 'materiali_arrivati'] as const

export type OrdineProntoInput = Pick<OrdineRow, 'stato'> & {
  tipi_ordine?: { nome?: string | null } | null
}

// Stessa definizione di "pronto" usata in MaterialiTab.tsx (ordinePronto): un ordine
// "da negozio" è già disponibile, altrimenti serve stato consegnato/accettato con riserva.
export const isOrdinePronto = (order: OrdineProntoInput): boolean => {
  const isDaNegozio = (order.tipi_ordine?.nome ?? '').toLowerCase() === 'negozio'
  return isDaNegozio || order.stato === 'consegnato' || order.stato === 'accettato_con_riserva'
}

// Dato l'elenco COMPLETO degli ordini attivi di una busta, calcola in quale dei 2 stati
// "materiali" la busta dovrebbe trovarsi. Ritorna null se non ci sono ordini attivi
// (tutti annullati, o nessun ordine) — in quel caso non va tentata nessuna transizione
// materiali_ordinati/materiali_arrivati qui; l'archiviazione per "tutti annullati" resta
// gestita separatamente da areAllOrdersCancelled/syncBustaWorkflowWithOrdini.
export const computeMaterialiWorkflowTarget = (
  orders: OrdineProntoInput[]
): 'materiali_ordinati' | 'materiali_arrivati' | null => {
  const ordiniAttivi = filterOrdiniAttivi(orders)
  if (ordiniAttivi.length === 0) return null
  return ordiniAttivi.every(isOrdinePronto) ? 'materiali_arrivati' : 'materiali_ordinati'
}

export const shouldArchiveBusta = (
  busta: Pick<BustaRow, 'stato_attuale' | 'updated_at'> & {
    ordini_materiali?: (OrdineRow | null)[] | null
    info_pagamenti?: InfoPagamenti | null
    payment_plan?: PaymentPlan | null
  },
  options?: { now?: Date }
): boolean => {
  const orders = busta.ordini_materiali ?? []

  if (areAllOrdersCancelled(orders)) {
    return true
  }

  if (busta.stato_attuale !== FINAL_STATE) {
    return false
  }

  const now = options?.now ?? new Date()
  const paymentCompletedAt = getPaymentCompletedAt({
    payment_plan: busta.payment_plan ?? null,
    info_pagamenti: busta.info_pagamenti ?? null
  })

  if (!paymentCompletedAt) {
    return false
  }

  return now.getTime() - paymentCompletedAt.getTime() >= ONE_DAY_MS
}
