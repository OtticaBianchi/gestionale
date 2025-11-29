export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logInsert } from '@/lib/audit/auditLog'

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

    const audit = await logInsert(
      'comunicazioni',
      data.id,
      user.id,
      {
        busta_id: data.busta_id,
        tipo_messaggio: data.tipo_messaggio,
        stato_invio: data.stato_invio,
        destinatario_nome: data.destinatario_nome,
        destinatario_tipo: data.destinatario_tipo,
        canale_invio: data.canale_invio
      },
      'Creazione comunicazione cliente',
      {
        source: 'api/comunicazioni',
        bustaId: body.bustaId,
        canale: data.canale_invio
      },
      profile.role
    )

    if (!audit.success) {
      console.error('AUDIT_INSERT_COMUNICAZIONI_FAILED', audit.error)
    }

    return NextResponse.json({ comunicazione: data })
  } catch (error) {
    console.error('Comunicazioni POST error:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
