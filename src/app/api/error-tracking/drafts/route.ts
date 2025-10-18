export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type AuthContext = {
  userId: string
  role: string | null
}

async function getAuthContext(): Promise<{ response?: NextResponse; context?: AuthContext }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (!user || error) {
    return { response: NextResponse.json({ error: 'Non autorizzato' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return { response: NextResponse.json({ error: 'Profilo non trovato' }, { status: 404 }) }
  }

  return { context: { userId: user.id, role: profile.role ?? null } }
}

export async function GET(request: NextRequest) {
  const auth = await getAuthContext()
  if (auth.response) return auth.response
  const { context } = auth

  if (context!.role !== 'admin') {
    return NextResponse.json({ error: 'Solo gli admin possono consultare le bozze errori' }, { status: 403 })
  }

  const adminClient = (await import('@supabase/supabase-js')).createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { searchParams } = new URL(request.url)
  const summary = searchParams.get('summary')

  if (summary === 'count') {
    const { count, error } = await adminClient
      .from('error_tracking')
      .select('id', { count: 'exact', head: true })
      .eq('is_draft', true)

    if (error) {
      console.error('Error counting error drafts:', error)
      return NextResponse.json({ error: 'Errore nel recupero del conteggio bozze' }, { status: 500 })
    }

    return NextResponse.json({ count: count ?? 0 })
  }

  const { data, error } = await adminClient
    .from('error_tracking')
    .select(`
      id,
      busta_id,
      employee_id,
      cliente_id,
      error_type,
      error_category,
      error_description,
      reported_at,
      auto_created_from_order,
      busta:buste(
        id,
        readable_id
      ),
      employee:profiles!error_tracking_employee_id_fkey(
        id,
        full_name
      )
    `)
    .eq('is_draft', true)
    .order('reported_at', { ascending: true })

  if (error) {
    console.error('Error fetching error drafts:', error)
    return NextResponse.json({ error: 'Errore nel recupero delle bozze' }, { status: 500 })
  }

  return NextResponse.json({ drafts: data ?? [] })
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext()
  if (auth.response) return auth.response
  const { context } = auth

  if (!context || !['admin', 'manager'].includes(context.role ?? '')) {
    return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body || !body.ordineId) {
    return NextResponse.json({ error: 'ordineId obbligatorio' }, { status: 400 })
  }

  const { ordineId } = body as { ordineId: string }

  const adminClient = (await import('@supabase/supabase-js')).createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: ordine, error: ordineError } = await adminClient
    .from('ordini_materiali')
    .select(`
      id,
      descrizione_prodotto,
      busta_id,
      creato_da,
      created_at,
      categoria_fornitore,
      stato,
      fornitori_lenti:fornitori_lenti(nome),
      fornitori_montature:fornitori_montature(nome),
      fornitori_lac:fornitori_lac(nome),
      fornitori_lab_esterno:fornitori_lab_esterno(nome),
      fornitori_sport:fornitori_sport(nome),
      busta:buste(
        id,
        readable_id,
        clienti (
          id,
          nome,
          cognome
        )
      )
    `)
    .eq('id', ordineId)
    .single()

  if (ordineError || !ordine) {
    console.error('Ordine non trovato per creazione bozza errore:', ordineError)
    return NextResponse.json({ error: 'Ordine materiali non trovato' }, { status: 404 })
  }

  const ordineData: any = ordine

  const { data: existingDraftRows } = await adminClient
    .from('error_tracking')
    .select('id')
    .eq('auto_created_from_order', ordineId)
    .limit(1)

  const existingDraft = existingDraftRows?.[0]

  if (existingDraft) {
    return NextResponse.json({
      success: true,
      alreadyExists: true,
      message: 'Bozza errore già presente per questo ordine',
      draftId: existingDraft.id
    })
  }

  let responsibleEmployeeId: string | null = ordineData.creato_da

  if (!responsibleEmployeeId) {
    const { data: history } = await adminClient
      .from('status_history')
      .select('operatore_id, stato, data_ingresso')
      .eq('busta_id', ordineData.busta_id)
      .in('stato', ['materiali_ordinati', 'materiali_arrivati'])
      .order('data_ingresso', { ascending: false })
      .limit(1)

    responsibleEmployeeId = history?.[0]?.operatore_id ?? null
  }

  if (!responsibleEmployeeId) {
    return NextResponse.json({
      error: 'Impossibile determinare il responsabile originale dell\'ordine',
      code: 'MISSING_EMPLOYEE'
    }, { status: 422 })
  }

  const bustaInfo = ordineData.busta as any
  const clienteRecord = bustaInfo?.clienti as any
  const clienteId = clienteRecord?.id ?? null
  const readableId = bustaInfo?.readable_id ?? ordineData.busta_id
  const prodotto = ordineData.descrizione_prodotto
  const fornitore =
    ordineData.fornitori_lenti?.nome ||
    ordineData.fornitori_montature?.nome ||
    ordineData.fornitori_lac?.nome ||
    ordineData.fornitori_lab_esterno?.nome ||
    ordineData.fornitori_sport?.nome ||
    'Non specificato'

  const descrizione = [
    `Ordine contrassegnato come “Sbagliato” per la busta ${readableId}.`,
    `Prodotto: ${prodotto}.`,
    `Fornitore: ${fornitore}.`,
    '',
    'Verificare l\'ordine inserito e completare le informazioni mancanti per chiudere l\'errore.'
  ].join(' ')

  const costDetail = `Bozza generata automaticamente dal sistema il ${new Date().toLocaleDateString('it-IT')} dopo segnalazione “Sbagliato”.`
  let costAmount: number | null = null

  const { data: defaultCost } = await adminClient
    .from('error_cost_defaults')
    .select('default_cost')
    .eq('error_type', 'materiali_ordine')
    .eq('error_category', 'medio')
    .eq('is_active', true)
    .maybeSingle()

  if (defaultCost?.default_cost) {
    costAmount = defaultCost.default_cost
  } else {
    costAmount = 100
  }

  const { data: newDraft, error: insertError } = await adminClient
    .from('error_tracking')
    .insert({
      busta_id: ordineData.busta_id,
      employee_id: responsibleEmployeeId,
      cliente_id: clienteId,
      error_type: 'materiali_ordine',
      error_category: 'medio',
      error_description: descrizione,
      cost_type: 'estimate',
      cost_amount: costAmount,
      cost_detail: costDetail,
      time_lost_minutes: 0,
      client_impacted: false,
      requires_reorder: true,
      reported_by: context.userId,
      is_draft: true,
      auto_created_from_order: ordineData.id
    })
    .select('id, error_type, error_category, error_description, reported_at')
    .single()

  if (insertError || !newDraft) {
    console.error('Errore creazione bozza error tracking:', insertError)
    return NextResponse.json({
      error: 'Errore durante la creazione della bozza',
      details: insertError?.message ?? null
    }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    draft: newDraft,
    message: 'Bozza errore creata con successo'
  })
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthContext()
  if (auth.response) return auth.response
  const { context } = auth

  if (!context || !['admin', 'manager'].includes(context.role ?? '')) {
    return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body || !body.id) {
    return NextResponse.json({ error: 'ID bozza obbligatorio' }, { status: 400 })
  }

  const {
    id,
    busta_id,
    employee_id,
    cliente_id,
    error_type,
    error_category,
    error_description,
    cost_type = 'estimate',
    custom_cost,
    cost_detail,
    time_lost_minutes = 0,
    client_impacted = false,
    requires_reorder = false
  } = body

  if (!employee_id || !error_type || !error_category || !error_description) {
    return NextResponse.json({ error: 'Campi obbligatori mancanti per completare la bozza' }, { status: 400 })
  }

  if (cost_type === 'real') {
    if (typeof custom_cost !== 'number' || Number.isNaN(custom_cost)) {
      return NextResponse.json({ error: 'Costo reale mancante o non valido' }, { status: 400 })
    }
    if (!cost_detail || typeof cost_detail !== 'string') {
      return NextResponse.json({ error: 'Dettaglio costo obbligatorio per costi reali' }, { status: 400 })
    }
  }

  const adminClient = (await import('@supabase/supabase-js')).createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  let costAmount: number | null = null

  if (cost_type === 'real') {
    costAmount = custom_cost as number
  } else if (typeof custom_cost === 'number' && !Number.isNaN(custom_cost)) {
    costAmount = custom_cost
  } else {
    const { data: defaultCost } = await adminClient
      .from('error_cost_defaults')
      .select('default_cost')
      .eq('error_type', error_type)
      .eq('error_category', error_category)
      .eq('is_active', true)
      .maybeSingle()

    if (defaultCost?.default_cost) {
      costAmount = defaultCost.default_cost
    } else {
      costAmount = 100
    }
  }

  const updatePayload: Record<string, any> = {
    busta_id: busta_id || null,
    employee_id,
    cliente_id: cliente_id || null,
    error_type,
    error_category,
    error_description,
    cost_type,
    cost_amount: costAmount,
    cost_detail: cost_type === 'real' ? cost_detail : cost_detail || null,
    time_lost_minutes,
    client_impacted,
    requires_reorder,
    is_draft: false,
    updated_at: new Date().toISOString()
  }

  const { error: updateError } = await adminClient
    .from('error_tracking')
    .update(updatePayload)
    .eq('id', id)

  if (updateError) {
    console.error('Errore aggiornamento bozza error tracking:', updateError)
    return NextResponse.json({ error: 'Errore durante il completamento della bozza', details: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Bozza completata con successo' })
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthContext()
  if (auth.response) return auth.response
  const { context } = auth

  if (!context || context.role !== 'admin') {
    return NextResponse.json({ error: 'Solo gli admin possono eliminare le bozze' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'ID bozza obbligatorio' }, { status: 400 })
  }

  const adminClient = (await import('@supabase/supabase-js')).createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: existing, error: fetchError } = await adminClient
    .from('error_tracking')
    .select('id, is_draft')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    console.error('Errore lettura bozza error tracking:', fetchError)
    return NextResponse.json({ error: 'Errore durante la verifica della bozza' }, { status: 500 })
  }

  if (!existing) {
    return NextResponse.json({ error: 'Bozza non trovata' }, { status: 404 })
  }

  if (!existing.is_draft) {
    return NextResponse.json({ error: 'Impossibile eliminare un errore già completato' }, { status: 409 })
  }

  const { error: deleteError } = await adminClient
    .from('error_tracking')
    .delete()
    .eq('id', id)

  if (deleteError) {
    console.error('Errore eliminazione bozza error tracking:', deleteError)
    return NextResponse.json({ error: 'Errore durante l\'eliminazione della bozza', details: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Bozza eliminata con successo' })
}
