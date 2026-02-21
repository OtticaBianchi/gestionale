export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logAuditChange } from '@/lib/audit/auditLog'
import { buildRequestTraceContext, getRequestId } from '@/lib/audit/requestTrace'

type ClientDiagnosticPayload = {
  code?: string
  severity?: 'info' | 'warn' | 'error'
  message?: string
  bustaId?: string | null
  readableId?: string | null
  oldStatus?: string | null
  newStatus?: string | null
  tipoLavorazione?: string | null
  incidentId?: string | null
  context?: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)
  const jsonWithRequestId = (payload: Record<string, unknown>, status = 200) => {
    const response = NextResponse.json(payload, { status })
    response.headers.set('x-request-id', requestId)
    return response
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return jsonWithRequestId({ error: 'Unauthorized' }, 401)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const trace = buildRequestTraceContext(request, {
      requestId,
      userId: user.id
    })

    const payload = (await request.json().catch(() => ({}))) as ClientDiagnosticPayload
    const code = (payload.code || 'KANBAN_CLIENT_DIAGNOSTIC').toString().slice(0, 120)

    const result = await logAuditChange(
      {
        tableName: 'kanban_diagnostics',
        recordId: payload.bustaId || 'kanban-board',
        action: 'INSERT',
        userId: user.id,
        userRole: profile?.role ?? null,
        reason: code,
        metadata: {
          source: 'client/kanban-board',
          stage: 'client',
          severity: payload.severity || 'warn',
          message: payload.message || null,
          busta_id: payload.bustaId || null,
          readable_id: payload.readableId || null,
          old_status: payload.oldStatus || null,
          new_status: payload.newStatus || null,
          tipo_lavorazione: payload.tipoLavorazione || null,
          incident_id: payload.incidentId || null,
          context: payload.context || null,
        },
      },
      {
        logToConsole: false,
        ipAddress: trace.ip_address || undefined,
        userAgent: trace.user_agent || undefined,
        requireUserId: true,
        trace: {
          ...trace,
          audit_event: 'kanban_client_diagnostic'
        },
      }
    )

    if (!result.success) {
      return jsonWithRequestId({ error: result.error || 'Log failed' }, 500)
    }

    return jsonWithRequestId({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return jsonWithRequestId({ error: message }, 500)
  }
}
