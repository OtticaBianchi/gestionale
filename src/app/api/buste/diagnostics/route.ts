export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logAuditChange } from '@/lib/audit/auditLog'

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

const getRequestIp = (request: NextRequest): string | undefined => {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get('x-real-ip')?.trim()
  return realIp || undefined
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

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
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Log failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
