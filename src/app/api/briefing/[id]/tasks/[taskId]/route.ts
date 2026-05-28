export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'

const patchSchema = z.object({
  assegnato_a: z.string().uuid().nullable().optional(),
  nota_admin: z.string().max(150).nullable().optional(),
  risolto: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id: snapshotId, taskId } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati non validi', details: parsed.error.flatten() }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if ('assegnato_a' in parsed.data) updates.assegnato_a = parsed.data.assegnato_a
    if ('nota_admin' in parsed.data) updates.nota_admin = parsed.data.nota_admin
    if ('risolto' in parsed.data) updates.risolto = parsed.data.risolto

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data, error } = await db
      .from('briefing_tasks')
      .update(updates)
      .eq('id', taskId)
      .eq('snapshot_id', snapshotId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Task non trovato' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json({ task: data })
  } catch (error) {
    console.error('[briefing/tasks] PATCH error:', error)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
