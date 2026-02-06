export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { logInsert, logUpdate } from '@/lib/audit/auditLog'
import {
  WorkflowState,
  isTransitionAllowed,
  getTransitionReason,
  isAdminOnlyTransition
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

const pickFollowUpAuditFields = (row: {
  archiviato?: boolean | null
  stato_chiamata?: string | null
  data_chiamata?: string | null
  data_completamento?: string | null
  note_chiamata?: string | null
  updated_at?: string | null
  updated_by?: string | null
} | null) => ({
  archiviato: row?.archiviato ?? null,
  stato_chiamata: row?.stato_chiamata ?? null,
  data_chiamata: row?.data_chiamata ?? null,
  data_completamento: row?.data_completamento ?? null,
  note_chiamata: row?.note_chiamata ?? null,
  updated_at: row?.updated_at ?? null,
  updated_by: row?.updated_by ?? null,
})

const FOLLOWUP_AUTO_ARCHIVE_MARKER = '[AUTO_ARCHIVE_UNDO_RITIRO]'

const appendFollowUpMarker = (note?: string | null): string => {
  if (!note) return FOLLOWUP_AUTO_ARCHIVE_MARKER
  if (note.includes(FOLLOWUP_AUTO_ARCHIVE_MARKER)) return note
  return `${note}\n${FOLLOWUP_AUTO_ARCHIVE_MARKER}`
}

const removeFollowUpMarker = (note?: string | null): string | null => {
  if (!note) return null
  const cleaned = note
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== FOLLOWUP_AUTO_ARCHIVE_MARKER && line !== '')
    .join('\n')
  return cleaned || null
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = profile?.role ?? null
    const isAdmin = userRole === 'admin'

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

    if (isAdminOnlyTransition(oldStatus, newStatus) && !isAdmin) {
      console.warn('KANBAN_UPDATE_FORBIDDEN_ROLE', {
        userId: user.id,
        bustaId,
        from: oldStatus,
        to: newStatus,
        userRole
      })

      return NextResponse.json({
        error: 'Solo admin può eseguire questa transizione',
        reason: 'Permesso insufficiente'
      }, { status: 403 })
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

    if (oldStatus === 'consegnato_pagato' && newStatus === 'pronto_ritiro') {
      updatePayload.stato_consegna = 'in_attesa'
      updatePayload.data_completamento_consegna = null
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

    let followUpWarning: string | undefined
    if (oldStatus === 'consegnato_pagato' && newStatus === 'pronto_ritiro') {
      const { data: followUps, error: followUpError } = await admin
        .from('follow_up_chiamate')
        .select('id, archiviato, stato_chiamata, data_chiamata, data_completamento, note_chiamata, updated_at, updated_by')
        .eq('busta_id', bustaId)
        .or('archiviato.is.null,archiviato.eq.false')

      if (followUpError) {
        console.error('KANBAN_FOLLOWUP_ARCHIVE_ERROR', {
          bustaId,
          error: followUpError.message
        })
        followUpWarning = followUpError.message
      } else if (followUps && followUps.length > 0) {
        for (const row of followUps) {
          const updatedSnapshot = {
            ...row,
            archiviato: true,
            note_chiamata: appendFollowUpMarker(row.note_chiamata),
            updated_at: now,
            updated_by: user.id
          }

          const { error: archiveError } = await admin
            .from('follow_up_chiamate')
            .update({
              archiviato: true,
              note_chiamata: updatedSnapshot.note_chiamata,
              updated_at: now,
              updated_by: user.id
            })
            .eq('id', row.id)

          if (archiveError) {
            console.error('KANBAN_FOLLOWUP_ARCHIVE_ERROR', {
              bustaId,
              error: archiveError.message
            })
            followUpWarning = archiveError.message
            continue
          }

          const audit = await logUpdate(
            'follow_up_chiamate',
            row.id,
            user.id,
            pickFollowUpAuditFields(row),
            pickFollowUpAuditFields(updatedSnapshot),
            'Archiviazione follow-up per annullamento ritiro',
            {
              source: 'api/buste/update-status',
              action: 'archive_followup_on_undo',
              bustaId
            },
            userRole
          )

          if (!audit.success) {
            console.error('AUDIT_ARCHIVE_FOLLOWUP_FAILED', audit.error)
          }
        }
      }
    }

    if (newStatus === 'consegnato_pagato') {
      const { data: archivedFollowUps, error: restoreError } = await admin
        .from('follow_up_chiamate')
        .select('id, archiviato, stato_chiamata, data_chiamata, data_completamento, note_chiamata, updated_at, updated_by')
        .eq('busta_id', bustaId)
        .eq('archiviato', true)
        .ilike('note_chiamata', `%${FOLLOWUP_AUTO_ARCHIVE_MARKER}%`)
        .order('updated_at', { ascending: false })
        .limit(1)

      if (restoreError) {
        console.error('KANBAN_FOLLOWUP_RESTORE_ERROR', {
          bustaId,
          error: restoreError.message
        })
        followUpWarning = restoreError.message
      } else if (archivedFollowUps && archivedFollowUps.length > 0) {
        const row = archivedFollowUps[0]
        const updatedSnapshot = {
          ...row,
          archiviato: false,
          note_chiamata: removeFollowUpMarker(row.note_chiamata),
          updated_at: now,
          updated_by: user.id
        }

        const { error: restoreUpdateError } = await admin
          .from('follow_up_chiamate')
          .update({
            archiviato: false,
            note_chiamata: updatedSnapshot.note_chiamata,
            updated_at: now,
            updated_by: user.id
          })
          .eq('id', row.id)

        if (restoreUpdateError) {
          console.error('KANBAN_FOLLOWUP_RESTORE_ERROR', {
            bustaId,
            error: restoreUpdateError.message
          })
          followUpWarning = restoreUpdateError.message
        } else {
          const audit = await logUpdate(
            'follow_up_chiamate',
            row.id,
            user.id,
            pickFollowUpAuditFields(row),
            pickFollowUpAuditFields(updatedSnapshot),
            'Ripristino follow-up dopo ritorno in consegnato',
            {
              source: 'api/buste/update-status',
              action: 'restore_followup_on_reclose',
              bustaId
            },
            userRole
          )

          if (!audit.success) {
            console.error('AUDIT_RESTORE_FOLLOWUP_FAILED', audit.error)
          }
        }
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
      followUpWarning
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
