import { Database } from '@/types/database.types'

type BustaRow = Database['public']['Tables']['buste']['Row']
type OrdineRow = Pick<Database['public']['Tables']['ordini_materiali']['Row'], 'stato'>

const CANCELLED_STATE = 'annullato'
const FINAL_STATE = 'consegnato_pagato'

const normalizeState = (value: string | null | undefined): string =>
  (value ?? '').toLowerCase()

export const areAllOrdersCancelled = (orders?: (OrdineRow | null)[] | null): boolean => {
  if (!orders || orders.length === 0) return false
  return orders.every(order => normalizeState(order?.stato) === CANCELLED_STATE)
}

export const hasActiveOrders = (orders?: (OrdineRow | null)[] | null): boolean => {
  if (!orders || orders.length === 0) return false
  return orders.some(order => normalizeState(order?.stato) !== CANCELLED_STATE)
}

export const shouldArchiveBusta = (
  busta: Pick<BustaRow, 'stato_attuale' | 'updated_at'> & {
    ordini_materiali?: (OrdineRow | null)[] | null
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

  if (!busta.updated_at) {
    return false
  }

  const now = options?.now ?? new Date()
  const updatedAt = new Date(busta.updated_at)
  const oneDayAgo = new Date(now)
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)

  return updatedAt < oneDayAgo
}
