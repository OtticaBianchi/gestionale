export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { logInsert } from '@/lib/audit/auditLog'

const VALID_MOTIVI = ['difetto_fabbricazione', 'ripensamento', 'incompatibilita', 'altro'] as const
type Motivo = typeof VALID_MOTIVI[number]

type AuthResult =
  | { response: NextResponse }
  | { supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>; userId: string; role: string | null }

async function authenticate(): Promise<AuthResult> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { response: NextResponse.json({ error: 'Non autorizzato' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return { supabase, userId: user.id, role: profile?.role ?? null }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticate()
    if ('response' in auth) return auth.response
    const { supabase } = auth

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Busta ID mancante' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('resi')
      .select(`
        id,
        busta_id,
        motivo,
        nota,
        error_tracking_id,
        registrato_at,
        created_at,
        registrato_da:profiles!resi_registrato_da_fkey(full_name)
      `)
      .eq('busta_id', id)
      .order('registrato_at', { ascending: false })

    if (error) {
      console.error('Errore caricamento resi:', error)
      return NextResponse.json({ error: 'Errore caricamento resi' }, { status: 500 })
    }

    return NextResponse.json({ success: true, resi: data ?? [] })

  } catch (error) {
    console.error('GET /api/buste/[id]/resi error:', error)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticate()
    if ('response' in auth) return auth.response
    const { userId, role } = auth

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Busta ID mancante' }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    const motivo: Motivo | undefined = body?.motivo
    const nota: string | undefined = typeof body?.nota === 'string' ? body.nota.trim() : undefined

    if (!motivo || !VALID_MOTIVI.includes(motivo)) {
      return NextResponse.json({ error: 'Motivo non valido' }, { status: 400 })
    }

    if (motivo === 'altro' && !nota) {
      return NextResponse.json({ error: 'Nota obbligatoria quando il motivo è "altro"' }, { status: 400 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: busta, error: bustaError } = await admin
      .from('buste')
      .select('id, readable_id, cliente_id')
      .eq('id', id)
      .single()

    if (bustaError || !busta) {
      console.error('Busta non trovata per creazione reso:', bustaError)
      return NextResponse.json({ error: 'Busta non trovata' }, { status: 404 })
    }

    const { data: reso, error: resoError } = await admin
      .from('resi')
      .insert({
        busta_id: id,
        motivo,
        nota: nota || null,
        registrato_da: userId
      })
      .select('id, busta_id, motivo, nota, error_tracking_id, registrato_da, registrato_at, created_at')
      .single()

    if (resoError || !reso) {
      console.error('Errore creazione reso:', resoError)
      return NextResponse.json({
        error: 'Errore durante la creazione del reso',
        details: resoError?.message ?? null
      }, { status: 500 })
    }

    const resoAudit = await logInsert(
      'resi',
      reso.id,
      userId,
      {
        busta_id: id,
        motivo,
        nota: nota || null,
        registrato_da: userId
      },
      'Registrazione reso',
      { bustaId: id },
      role
    )

    if (!resoAudit.success) {
      console.error('AUDIT_RESO_INSERT_FAILED', resoAudit.error)
    }

    let errorDraftCreated = false

    if (motivo === 'difetto_fabbricazione') {
      const descrizione = [
        `Reso per difetto di fabbricazione registrato sulla busta ${busta.readable_id}.`,
        nota ? `Nota: ${nota}.` : '',
        '',
        'Completare la classificazione ET2.0 per chiudere l\'errore.'
      ].join(' ')

      const { data: defaultCost } = await admin
        .from('error_cost_defaults')
        .select('default_cost')
        .eq('error_type', 'consegna_prodotto')
        .eq('error_category', 'medio')
        .eq('is_active', true)
        .maybeSingle()

      const costAmount = defaultCost?.default_cost ?? 100

      const { data: errorDraft, error: errorDraftError } = await admin
        .from('error_tracking')
        .insert({
          busta_id: id,
          cliente_id: busta.cliente_id ?? null,
          employee_id: null,
          error_type: 'consegna_prodotto',
          error_category: 'medio',
          error_description: descrizione,
          cost_type: 'estimate',
          cost_amount: costAmount,
          reported_by: userId,
          is_draft: true,
          causa_errore: 'esterno'
        })
        .select('id')
        .single()

      if (errorDraftError || !errorDraft) {
        console.error('Errore creazione bozza error_tracking per reso:', errorDraftError)
      } else {
        errorDraftCreated = true

        const { error: linkError } = await admin
          .from('resi')
          .update({ error_tracking_id: errorDraft.id })
          .eq('id', reso.id)

        if (linkError) {
          console.error('Errore collegamento reso -> error_tracking:', linkError)
        } else {
          reso.error_tracking_id = errorDraft.id
        }

        const errorDraftAudit = await logInsert(
          'error_tracking',
          errorDraft.id,
          userId,
          {
            busta_id: id,
            cliente_id: busta.cliente_id ?? null,
            error_type: 'consegna_prodotto',
            error_category: 'medio',
            error_description: descrizione,
            cost_type: 'estimate',
            cost_amount: costAmount,
            reported_by: userId,
            is_draft: true,
            causa_errore: 'esterno'
          },
          'Bozza errore creata automaticamente da reso per difetto di fabbricazione',
          { bustaId: id, resoId: reso.id },
          role
        )

        if (!errorDraftAudit.success) {
          console.error('AUDIT_ERROR_TRACKING_DRAFT_INSERT_FAILED', errorDraftAudit.error)
        }
      }
    }

    return NextResponse.json({
      success: true,
      reso,
      errorDraftCreated
    })

  } catch (error) {
    console.error('POST /api/buste/[id]/resi error:', error)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}
