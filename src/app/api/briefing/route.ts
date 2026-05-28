export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'

const taskSchema = z.object({
  busta_id: z.string().uuid(),
  sezione: z.enum(['urgenze', 'flusso_inceppato', 'materiali_ritardo', 'manuale']),
  motivo: z.string().min(1),
  assegnato_a: z.string().uuid().nullable().optional(),
  nota_admin: z.string().max(150).nullable().optional(),
})

const postSchema = z.object({
  note_generali: z.string().nullable().optional(),
  tasks: z.array(taskSchema),
})

async function requireAdmin(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, error: NextResponse.json({ error: 'Non autorizzato' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { user: null, error: NextResponse.json({ error: 'Accesso negato' }, { status: 403 }) }
  }

  return { user, error: null }
}

// GET — lista snapshot (ultimi 30)
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { error: authError } = await requireAdmin(supabase)
    if (authError) return authError

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data, error: dbError } = await db
      .from('briefing_snapshots')
      .select('*, generato_da_profile:generato_da(full_name)')
      .order('data_briefing', { ascending: false })
      .limit(30)

    if (dbError) throw dbError

    return NextResponse.json({ snapshots: data })
  } catch (error) {
    console.error('[briefing] GET error:', error)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}

// POST — crea nuovo snapshot con tasks
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { user, error: authError } = await requireAdmin(supabase)
    if (authError) return authError

    const body = await request.json()
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dati non validi', details: parsed.error.flatten() }, { status: 400 })
    }

    const { note_generali, tasks } = parsed.data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data: snapshot, error: snapError } = await db
      .from('briefing_snapshots')
      .insert({
        generato_da: user!.id,
        note_generali: note_generali ?? null,
        data_briefing: new Date().toISOString().slice(0, 10),
      })
      .select()
      .single()

    if (snapError) throw snapError

    if (tasks.length > 0) {
      const taskRows = tasks.map(t => ({
        snapshot_id: snapshot.id,
        busta_id: t.busta_id,
        sezione: t.sezione,
        motivo: t.motivo,
        assegnato_a: t.assegnato_a ?? null,
        nota_admin: t.nota_admin ?? null,
        risolto: false,
      }))

      const { error: tasksError } = await db
        .from('briefing_tasks')
        .insert(taskRows)

      if (tasksError) throw tasksError
    }

    const { data: full, error: fullError } = await db
      .from('briefing_snapshots')
      .select('*, generato_da_profile:generato_da(full_name), tasks:briefing_tasks(*)')
      .eq('id', snapshot.id)
      .single()

    if (fullError) throw fullError

    return NextResponse.json({ snapshot: full }, { status: 201 })
  } catch (error) {
    console.error('[briefing] POST error:', error)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
