export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { logInsert, logUpdate } from '@/lib/audit/auditLog'
import {
  WorkflowState,
  isTransitionAllowed,
  getTransitionReason
} from '@/app/dashboard/_components/WorkflowLogic'

interface UpdateStatusPayload {
  bustaId?: string
  oldStatus?: WorkflowState
  newStatus?: WorkflowState
  tipoLavorazione?: string | null
}

const pickBustaAuditFields = (row: { stato_attuale?: WorkflowState | null; updated_at?: string | null; updated_by?: string | null } | null) => ({
  stato_attuale: row?.stato_attuale ?? null,
  updated_at: row?.updated_at ?? null,
  updated_by: row?.updated_by ?? null
})

const pickHistoryAuditFields = (row: {
  busta_id?: string | null
  stato?: WorkflowState | null
  data_ingresso?: string | null
  operatore_id?: string | null
  note_stato?: string | null
} | null) => ({
  busta_id: row?.busta_id ?? null,
  stato: row?.stato ?? null,
  data_ingresso: row?.data_ingresso ?? null,
  operatore_id: row?.operatore_id ?? null,
  note_stato: row?.note_stato ?? null
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.warn('KANBAN_UPDATE_AUTH_FAILURE', {
        error: authError?.message,
        timestamp: new Date().toISOString(),
      })

      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = profile?.role ?? null

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const body: UpdateStatusPayload = await request.json()
    const { bustaId, oldStatus, newStatus, tipoLavorazione = null } = body

    if (!bustaId || !oldStatus || !newStatus) {
      return NextResponse.json({
        error: 'Missing required fields',
      }, { status: 400 })
    }

    console.info('KANBAN_UPDATE_REQUEST', {
      userId: user.id,
      bustaId,
      from: oldStatus,
      to: newStatus,
      tipoLavorazione,
      timestamp: new Date().toISOString(),
    })

    if (!isTransitionAllowed(oldStatus, newStatus, tipoLavorazione)) {
      console.warn('KANBAN_UPDATE_FORBIDDEN', {
        userId: user.id,
        bustaId,
        from: oldStatus,
        to: newStatus,
        tipoLavorazione,
      })

      return NextResponse.json({
        error: 'Transition not allowed',
        reason: getTransitionReason(oldStatus, newStatus, tipoLavorazione),
      }, { status: 400 })
    }

    const now = new Date().toISOString()

    const { data: existingBusta, error: fetchError } = await admin
      .from('buste')
      .select('id, readable_id, stato_attuale, updated_at, updated_by')
      .eq('id', bustaId)
      .single()

    if (fetchError || !existingBusta) {
      console.error('KANBAN_UPDATE_FETCH_ERROR', {
        bustaId,
        error: fetchError?.message
      })
      return NextResponse.json({ error: 'Busta non trovata' }, { status: 404 })
    }

    const updatePayload: Record<string, any> = {
      stato_attuale: newStatus,
      updated_by: user.id,
      updated_at: now,
    }

    if (newStatus === 'in_lavorazione' && (oldStatus === 'pronto_ritiro' || oldStatus === 'consegnato_pagato')) {
      updatePayload.controllo_completato = false
      updatePayload.controllo_completato_da = null
      updatePayload.controllo_completato_at = null
    }

    const { data: updatedBuste, error: updateError } = await admin
      .from('buste')
      .update(updatePayload)
      .eq('id', bustaId)
      .eq('stato_attuale', oldStatus) // optimistic concurrency control
      .select('id, readable_id, stato_attuale, updated_at, updated_by')

    if (updateError) {
      console.error('KANBAN_UPDATE_DB_ERROR', {
        userId: user.id,
        bustaId,
        from: oldStatus,
        to: newStatus,
        error: updateError.message,
      })

      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    if (!updatedBuste || updatedBuste.length === 0) {
      console.warn('KANBAN_UPDATE_CONFLICT', {
        userId: user.id,
        bustaId,
        from: oldStatus,
        to: newStatus,
      })

      return NextResponse.json({
        error: 'Conflict: stato aggiornato da un altro utente',
      }, { status: 409 })
    }

    const updatedBusta = updatedBuste[0]

    const auditBusta = await logUpdate(
      'buste',
      bustaId,
      user.id,
      pickBustaAuditFields(existingBusta),
      pickBustaAuditFields(updatedBusta),
      'Aggiornamento stato Kanban',
      {
        source: 'api/buste/update-status',
        from: oldStatus,
        to: newStatus
      },
      userRole
    )

    if (!auditBusta.success) {
      console.error('AUDIT_UPDATE_KANBAN_FAILED', auditBusta.error)
    }

    const { data: historyRow, error: historyError } = await admin
      .from('status_history')
      .insert({
        busta_id: bustaId,
        stato: newStatus,
        data_ingresso: now,
        operatore_id: user.id,
        note_stato: getTransitionReason(oldStatus, newStatus, tipoLavorazione),
      })
      .select('id, busta_id, stato, data_ingresso, operatore_id, note_stato')
      .single()

    if (historyError) {
      console.error('KANBAN_HISTORY_ERROR', {
        userId: user.id,
        bustaId,
        error: historyError.message,
      })
    } else if (historyRow) {
      const auditHistory = await logInsert(
        'status_history',
        historyRow.id,
        user.id,
        pickHistoryAuditFields(historyRow),
        'Nuovo stato Kanban',
        {
          source: 'api/buste/update-status',
          bustaReadableId: updatedBusta.readable_id,
          from: oldStatus,
          to: newStatus
        },
        userRole
      )

      if (!auditHistory.success) {
        console.error('AUDIT_INSERT_STATUS_HISTORY_FAILED', auditHistory.error)
      }
    }

    const kanbanLogInsert = await admin
      .from('kanban_update_logs')
      .insert({
        busta_id: bustaId,
        from_status: oldStatus,
        to_status: newStatus,
        user_id: user.id,
        note: getTransitionReason(oldStatus, newStatus, tipoLavorazione),
        metadata: {
          readable_id: updatedBusta.readable_id,
          history_warning: historyError?.message ?? null,
        },
      })

    if (kanbanLogInsert.error) {
      console.error('KANBAN_LOG_ERROR', {
        userId: user.id,
        bustaId,
        error: kanbanLogInsert.error.message,
      })
    }

    console.info('KANBAN_UPDATE_SUCCESS', {
      userId: user.id,
      bustaId,
      from: oldStatus,
      to: newStatus,
      updatedAt: now,
    })

    return NextResponse.json({
      success: true,
      busta: updatedBusta,
      historyWarning: historyError?.message,
    })
  } catch (error: any) {
    console.error('KANBAN_UPDATE_UNEXPECTED_ERROR', {
      message: error?.message,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      error: 'Unexpected error updating busta',
    }, { status: 500 })
  }
}
