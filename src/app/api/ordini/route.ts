export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logInsert } from '@/lib/audit/auditLog'

// List ordini_materiali with optional status filter and overdue logic
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // da_ordinare | ordinato | in_arrivo | in_ritardo | consegnato | all

    // Auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

    // Role check (manager or admin)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = profile?.role
    if (role !== 'admin' && role !== 'manager') {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
    }

    // Use service role to bypass restrictive RLS safely after role check
    const admin = (await import('@supabase/supabase-js')).createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Base query
    let query = admin
      .from('ordini_materiali')
      .select(`
        *,
        buste:busta_id (id, readable_id, stato_attuale, clienti:cliente_id (id, nome, cognome, telefono))
      `)
      .order('data_ordine', { ascending: false })

    if (status && status !== 'all') {
      if (status === 'in_ritardo') {
        const today = new Date().toISOString()
        query = query
          .neq('stato', 'consegnato' as any)
          .lt('data_consegna_prevista', today)
      } else {
        query = query.eq('stato', status)
      }
    }

    const { data, error } = await query
    if (error) {
      console.error('Ordini list error:', error)
      return NextResponse.json({ error: 'Errore caricamento ordini' }, { status: 500 })
    }

    return NextResponse.json({ ordini: data || [] })
  } catch (e) {
    console.error('Ordini GET error:', e)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}

// Create a new ordine_materiale (used by MaterialiTab)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Payload non valido' }, { status: 400 })
    }

    const descrizione = typeof body.descrizione_prodotto === 'string'
      ? body.descrizione_prodotto.trim()
      : ''

    if (!descrizione) {
      return NextResponse.json({ error: 'La descrizione del prodotto è obbligatoria' }, { status: 400 })
    }

    if (!body.busta_id) {
      return NextResponse.json({ error: 'busta_id mancante' }, { status: 400 })
    }

    const orderData = {
      ...body,
      descrizione_prodotto: descrizione,
      updated_by: user.id,
      creato_da: body.creato_da ?? user.id,
      updated_at: new Date().toISOString()
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const { data: ordine, error } = await supabase
      .from('ordini_materiali')
      .insert(orderData)
      .select(`
        *,
        fornitori_lenti:fornitori_lenti(nome),
        fornitori_lac:fornitori_lac(nome),
        fornitori_montature:fornitori_montature(nome),
        fornitori_lab_esterno:fornitori_lab_esterno(nome),
        fornitori_sport:fornitori_sport(nome),
        tipi_lenti:tipi_lenti(nome, giorni_consegna_stimati),
        tipi_ordine:tipi_ordine(nome)
      `)
      .single()

    if (error || !ordine) {
      console.error('Ordine create error:', error)
      return NextResponse.json({ error: 'Errore creazione ordine' }, { status: 500 })
    }

    const audit = await logInsert(
      'ordini_materiali',
      ordine.id,
      user.id,
      {
        busta_id: ordine.busta_id,
        descrizione_prodotto: ordine.descrizione_prodotto,
        stato: ordine.stato,
        da_ordinare: ordine.da_ordinare
      },
      'Creazione ordine materiale',
      { bustaId: ordine.busta_id },
      profile?.role ?? null
    )

    if (!audit.success) {
      console.error('AUDIT_CREATE_ORDINE_FAILED', audit.error)
    }

    return NextResponse.json({ success: true, ordine })

  } catch (e) {
    console.error('Ordini POST error:', e)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}
