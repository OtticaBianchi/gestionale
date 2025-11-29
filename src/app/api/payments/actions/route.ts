export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { logDelete, logInsert, logUpdate } from '@/lib/audit/auditLog'
import type { Database } from '@/types/database.types'

type ActionRequest = {
  action: string
  payload?: any
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables')
}

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = profile?.role ?? null

    const body: ActionRequest = await request.json().catch(() => ({ action: '' }))
    if (!body.action) {
      return NextResponse.json({ error: 'Azione mancante' }, { status: 400 })
    }

    let result: Record<string, any> | null = null

    switch (body.action) {
      case 'create_plan':
        result = await handleCreatePlan(body.payload, user.id, userRole)
        break
      case 'delete_plan':
        result = await handleDeletePlan(body.payload, user.id, userRole)
        break
      case 'update_total':
        result = await handleUpdateTotal(body.payload, user.id, userRole)
        break
      case 'update_installment':
        result = await handleUpdateInstallment(body.payload, user.id, userRole)
        break
      case 'toggle_reminder':
        result = await handleToggleReminder(body.payload, user.id, userRole)
        break
      case 'complete_plan':
        result = await handleCompletePlan(body.payload, user.id, userRole)
        break
      case 'close_busta':
        result = await handleCloseBusta(body.payload, user.id, userRole)
        break
      case 'sync_plan_acconto':
        result = await handleSyncPlanAcconto(body.payload, user.id, userRole)
        break
      default:
        return NextResponse.json({ error: 'Azione non supportata' }, { status: 400 })
    }

    return NextResponse.json({ success: true, ...(result ?? {}) })

  } catch (error: any) {
    console.error('POST /api/payments/actions error:', error)
    return NextResponse.json({ error: error?.message ?? 'Errore interno server' }, { status: 500 })
  }
}

async function handleCreatePlan(payload: any, userId: string, userRole: string | null) {
  const {
    bustaId,
    totalAmount,
    acconto,
    paymentType,
    reminderPreference,
    installments,
    modalitaSaldo
  } = payload || {}

  if (!bustaId || typeof totalAmount !== 'number' || totalAmount <= 0 || !paymentType) {
    throw new Error('Parametri piano pagamenti mancanti o invalidi')
  }

  const now = new Date().toISOString()

  const planPayload = {
    busta_id: bustaId,
    total_amount: totalAmount,
    acconto: acconto ?? 0,
    payment_type: paymentType,
    auto_reminders_enabled: paymentType === 'installments' && reminderPreference === 'automatic',
    reminder_preference: paymentType === 'installments' ? (reminderPreference || 'manual') : 'disabled',
    is_completed: paymentType === 'finanziamento_bancario',
    created_at: now,
    updated_at: now
  }

  const { data: plan, error: planError } = await admin
    .from('payment_plans')
    .insert(planPayload)
    .select('*')
    .single()

  if (planError || !plan) {
    console.error('Errore creazione piano:', planError)
    throw new Error('Errore creazione piano pagamenti')
  }

  await logInsert(
    'payment_plans',
    plan.id,
    userId,
    {
      total_amount: plan.total_amount,
      payment_type: plan.payment_type,
      reminder_preference: plan.reminder_preference,
      busta_id: plan.busta_id
    },
    'Creazione piano pagamenti',
    { bustaId: bustaId },
    userRole
  )

  let insertedInstallments: any[] = []

  if (paymentType === 'installments' && Array.isArray(installments) && installments.length > 0) {
    const installmentsPayload = installments.map((inst: any, index: number) => ({
      payment_plan_id: plan.id,
      installment_number: index + 1,
      due_date: inst.dueDate,
      expected_amount: Number.parseFloat(inst.amount),
      paid_amount: 0,
      is_completed: false,
      reminder_3_days_sent: false,
      reminder_10_days_sent: false,
      created_at: now,
      updated_at: now
    }))

    const { data: createdInstallments, error: instError } = await admin
      .from('payment_installments')
      .insert(installmentsPayload)
      .select('*')

    if (instError) {
      console.error('Errore creazione rate:', instError)
      throw new Error('Errore creazione rate')
    }

    insertedInstallments = createdInstallments ?? []

    for (const installment of insertedInstallments) {
      await logInsert(
        'payment_installments',
        installment.id,
        userId,
        {
          expected_amount: installment.expected_amount,
          due_date: installment.due_date,
          payment_plan_id: installment.payment_plan_id
        },
        'Creazione rata piano pagamenti',
        { bustaId },
        userRole
      )
    }
  }

  await upsertInfoPagamenti(
    {
      busta_id: bustaId,
      prezzo_finale: totalAmount,
      importo_acconto: acconto ?? 0,
      ha_acconto: (acconto ?? 0) > 0,
      modalita_saldo: modalitaSaldo || paymentType,
      is_saldato: paymentType === 'finanziamento_bancario',
      data_saldo: paymentType === 'finanziamento_bancario' ? now : null
    },
    userId,
    userRole,
    'Sincronizzazione info_pagamenti da nuovo piano'
  )

  return { plan, installments: insertedInstallments }
}

async function handleDeletePlan(payload: any, userId: string, userRole: string | null) {
  const { paymentPlanId } = payload || {}
  if (!paymentPlanId) throw new Error('paymentPlanId mancante')

  const { data: plan, error } = await admin
    .from('payment_plans')
    .select('*')
    .eq('id', paymentPlanId)
    .single()

  if (error || !plan) {
    throw new Error('Piano pagamenti non trovato')
  }

  const { data: installments } = await admin
    .from('payment_installments')
    .select('*')
    .eq('payment_plan_id', paymentPlanId)

  await admin
    .from('payment_installments')
    .delete()
    .eq('payment_plan_id', paymentPlanId)

  if (installments) {
    for (const installment of installments) {
      await logDelete(
        'payment_installments',
        installment.id,
        userId,
        installment,
        'Eliminazione rata per cancellazione piano',
        { paymentPlanId },
        userRole
      )
    }
  }

  const { error: deletePlanError } = await admin
    .from('payment_plans')
    .delete()
    .eq('id', paymentPlanId)

  if (deletePlanError) {
    throw new Error('Errore eliminazione piano pagamenti')
  }

  await logDelete(
    'payment_plans',
    paymentPlanId,
    userId,
    plan,
    'Eliminazione piano pagamenti',
    { bustaId: plan.busta_id },
    userRole
  )

  return { message: 'Piano eliminato' }
}

async function handleUpdateTotal(payload: any, userId: string, userRole: string | null) {
  const { bustaId, paymentPlanId, totalAmount } = payload || {}
  if (!bustaId || typeof totalAmount !== 'number' || totalAmount < 0) {
    throw new Error('Parametri totali mancanti o invalidi')
  }

  if (paymentPlanId) {
    const { data: plan } = await admin
      .from('payment_plans')
      .select('*')
      .eq('id', paymentPlanId)
      .single()

    if (plan) {
      const { data: updatedPlan, error: planUpdateError } = await admin
        .from('payment_plans')
        .update({ total_amount: totalAmount, updated_at: new Date().toISOString() })
        .eq('id', paymentPlanId)
        .select('*')
        .single()

      if (planUpdateError || !updatedPlan) {
        throw new Error('Errore aggiornamento piano pagamenti')
      }

      await logUpdate(
        'payment_plans',
        paymentPlanId,
        userId,
        plan,
        updatedPlan,
        'Aggiornamento totale piano pagamenti',
        { bustaId },
        userRole
      )
    }
  }

  await upsertInfoPagamenti(
    {
      busta_id: bustaId,
      prezzo_finale: totalAmount
    },
    userId,
    userRole,
    'Aggiornamento totale preventivato'
  )

  return { message: 'Totale aggiornato' }
}

async function handleUpdateInstallment(payload: any, userId: string, userRole: string | null) {
  const { installmentId, amount, isCompleted } = payload || {}
  if (!installmentId || typeof amount !== 'number') {
    throw new Error('Parametri rata mancanti')
  }

  const { data: installment, error } = await admin
    .from('payment_installments')
    .select('*')
    .eq('id', installmentId)
    .single()

  if (error || !installment) {
    throw new Error('Rata non trovata')
  }

  const { data: updated, error: updateError } = await admin
    .from('payment_installments')
    .update({
      paid_amount: amount,
      is_completed: !!isCompleted,
      updated_at: new Date().toISOString()
    })
    .eq('id', installmentId)
    .select('*')
    .single()

  if (updateError || !updated) {
    throw new Error('Errore aggiornamento rata')
  }

  await logUpdate(
    'payment_installments',
    installmentId,
    userId,
    installment,
    updated,
    'Aggiornamento rata pagamento',
    { paymentPlanId: installment.payment_plan_id },
    userRole
  )

  return { installment: updated }
}

async function handleToggleReminder(payload: any, userId: string, userRole: string | null) {
  const { paymentPlanId, preference } = payload || {}
  if (!paymentPlanId || !preference) {
    throw new Error('Parametri reminder mancanti')
  }

  const { data: existingPlan } = await admin
    .from('payment_plans')
    .select('*')
    .eq('id', paymentPlanId)
    .single()

  if (!existingPlan) {
    throw new Error('Piano non trovato')
  }

  const { data: updatedPlan, error } = await admin
    .from('payment_plans')
    .update({
      reminder_preference: preference,
      auto_reminders_enabled: preference === 'automatic',
      updated_at: new Date().toISOString()
    })
    .eq('id', paymentPlanId)
    .select('*')
    .single()

  if (error || !updatedPlan) {
    throw new Error('Errore aggiornamento reminder')
  }

  await logUpdate(
    'payment_plans',
    paymentPlanId,
    userId,
    existingPlan,
    updatedPlan,
    'Aggiornamento preferenze reminder',
    { bustaId: existingPlan.busta_id },
    userRole
  )

  return { plan: updatedPlan }
}

async function handleCompletePlan(payload: any, userId: string, userRole: string | null) {
  const { paymentPlanId, bustaId } = payload || {}
  if (!paymentPlanId || !bustaId) {
    throw new Error('Parametri completamento piano mancanti')
  }

  const { data: plan } = await admin
    .from('payment_plans')
    .select('*')
    .eq('id', paymentPlanId)
    .single()

  if (!plan) {
    throw new Error('Piano non trovato')
  }

  const now = new Date().toISOString()
  const { data: updatedPlan, error } = await admin
    .from('payment_plans')
    .update({ is_completed: true, updated_at: now })
    .eq('id', paymentPlanId)
    .select('*')
    .single()

  if (error || !updatedPlan) {
    throw new Error('Errore completamento piano')
  }

  await logUpdate(
    'payment_plans',
    paymentPlanId,
    userId,
    plan,
    updatedPlan,
    'Completamento piano pagamenti',
    { bustaId },
    userRole
  )

  await upsertInfoPagamenti(
    {
      busta_id: bustaId,
      is_saldato: true,
      data_saldo: now
    },
    userId,
    userRole,
    'Piano completato - info_pagamenti'
  )

  return { message: 'Piano completato' }
}

async function handleCloseBusta(payload: any, userId: string, userRole: string | null) {
  const { bustaId } = payload || {}
  if (!bustaId) throw new Error('bustaId mancante')

  const { data: existingBusta } = await admin
    .from('buste')
    .select('id, stato_attuale')
    .eq('id', bustaId)
    .single()

  if (!existingBusta) {
    throw new Error('Busta non trovata')
  }

  const { data: updatedBusta, error } = await admin
    .from('buste')
    .update({ stato_attuale: 'consegnato_pagato', updated_at: new Date().toISOString(), updated_by: userId })
    .eq('id', bustaId)
    .select('id, stato_attuale, updated_at')
    .single()

  if (error || !updatedBusta) {
    throw new Error('Errore chiusura busta')
  }

  await logUpdate(
    'buste',
    bustaId,
    userId,
    existingBusta,
    updatedBusta,
    'Busta segnata come consegnato pagato',
    { bustaId },
    userRole
  )

  return { message: 'Busta aggiornata' }
}

async function handleSyncPlanAcconto(payload: any, userId: string, userRole: string | null) {
  const { paymentPlanId, acconto } = payload || {}
  if (!paymentPlanId || typeof acconto !== 'number') {
    throw new Error('Parametri sync acconto mancanti')
  }

  const { data: plan } = await admin
    .from('payment_plans')
    .select('*')
    .eq('id', paymentPlanId)
    .single()

  if (!plan) {
    throw new Error('Piano non trovato')
  }

  const { data: updatedPlan, error } = await admin
    .from('payment_plans')
    .update({ acconto, updated_at: new Date().toISOString() })
    .eq('id', paymentPlanId)
    .select('*')
    .single()

  if (error || !updatedPlan) {
    throw new Error('Errore aggiornamento acconto piano')
  }

  await logUpdate(
    'payment_plans',
    paymentPlanId,
    userId,
    plan,
    updatedPlan,
    'Sincronizzazione acconto piano pagamenti',
    { bustaId: plan.busta_id },
    userRole
  )

  return { plan: updatedPlan }
}

async function upsertInfoPagamenti(
  payload: Partial<Database['public']['Tables']['info_pagamenti']['Row']> & { busta_id: string },
  userId: string,
  userRole: string | null,
  reason: string
) {
  const { data: existing } = await admin
    .from('info_pagamenti')
    .select('id, busta_id, prezzo_finale, importo_acconto, ha_acconto, note_pagamento, is_saldato, data_saldo, modalita_saldo')
    .eq('busta_id', payload.busta_id)
    .maybeSingle()

  const { data: upserted, error } = await admin
    .from('info_pagamenti')
    .upsert({
      ...payload,
      updated_at: new Date().toISOString()
    }, { onConflict: 'busta_id' })
    .select('*')
    .single()

  if (error || !upserted) {
    throw new Error('Errore aggiornamento info_pagamenti')
  }

  if (existing) {
    await logUpdate(
      'info_pagamenti',
      upserted.id,
      userId,
      existing,
      upserted,
      reason,
      { bustaId: payload.busta_id },
      userRole
    )
  } else {
    await logInsert(
      'info_pagamenti',
      upserted.id,
      userId,
      {
        busta_id: payload.busta_id,
        prezzo_finale: upserted.prezzo_finale,
        importo_acconto: upserted.importo_acconto,
        is_saldato: upserted.is_saldato
      },
      reason,
      { bustaId: payload.busta_id },
      userRole
    )
  }
}
