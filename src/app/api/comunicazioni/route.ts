export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type RequestPayload = {
  bustaId?: string
  tipoMessaggio?: string
  testoMessaggio?: string
  destinatarioNome?: string | null
  destinatarioContatto?: string | null
  destinatarioTipo?: string
  canaleInvio?: string | null
  statoInvio?: string | null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Utente non autenticato' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profilo utente non trovato' }, { status: 403 })
    }

    if (profile.role === 'operatore') {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
    }

    const body = (await request.json()) as RequestPayload

    if (!body.bustaId) {
      return NextResponse.json({ error: 'ID busta obbligatorio' }, { status: 400 })
    }

    if (!body.tipoMessaggio) {
      return NextResponse.json({ error: 'Tipo messaggio obbligatorio' }, { status: 400 })
    }

    if (!body.testoMessaggio?.trim()) {
      return NextResponse.json({ error: 'Testo messaggio obbligatorio' }, { status: 400 })
    }

    if (
      body.tipoMessaggio !== 'nota_comunicazione_cliente' &&
      !body.destinatarioNome
    ) {
      return NextResponse.json({ error: 'Destinatario obbligatorio' }, { status: 400 })
    }

    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const payload = {
      busta_id: body.bustaId,
      tipo_messaggio: body.tipoMessaggio,
      testo_messaggio: body.testoMessaggio.trim(),
      destinatario_nome: body.destinatarioNome ?? '',
      destinatario_contatto: body.destinatarioContatto ?? '',
      destinatario_tipo: body.destinatarioTipo ?? 'cliente',
      canale_invio: body.canaleInvio ?? 'whatsapp',
      stato_invio: body.statoInvio ?? 'inviato',
      inviato_da: user.id,
      nome_operatore: profile.full_name ?? 'Operatore',
      data_invio: new Date().toISOString(),
    }

    const { data, error } = await admin
      .from('comunicazioni')
      .insert(payload)
      .select()
      .single()

    if (error) {
      console.error('Comunicazioni insert error:', error)
      return NextResponse.json({ error: 'Errore durante il salvataggio della comunicazione' }, { status: 500 })
    }

    return NextResponse.json({ comunicazione: data })
  } catch (error) {
    console.error('Comunicazioni POST error:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
