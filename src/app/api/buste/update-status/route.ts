export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
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

    const { data: updatedBuste, error: updateError } = await supabase
      .from('buste')
      .update({
        stato_attuale: newStatus,
        updated_at: now,
      })
      .eq('id', bustaId)
      .eq('stato_attuale', oldStatus) // optimistic concurrency control
      .select('id, readable_id, stato_attuale, updated_at')

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

    const { error: historyError } = await supabase
      .from('status_history')
      .insert({
        busta_id: bustaId,
        stato: newStatus,
        data_ingresso: now,
        operatore_id: user.id,
        note_stato: getTransitionReason(oldStatus, newStatus, tipoLavorazione),
      })

    if (historyError) {
      console.error('KANBAN_HISTORY_ERROR', {
        userId: user.id,
        bustaId,
        error: historyError.message,
      })
    }

    const logInsert = await supabase
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

    if (logInsert.error) {
      console.error('KANBAN_LOG_ERROR', {
        userId: user.id,
        bustaId,
        error: logInsert.error.message,
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
