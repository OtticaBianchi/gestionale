import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logUpdate } from '@/lib/audit/auditLog'
import { categorizeCustomer, type LivelloSoddisfazione } from '@/lib/fu2/categorizeCustomer'
import { createClient } from '@supabase/supabase-js'

const pickFollowUpAuditFields = (row: any) => ({
  stato_chiamata: row?.stato_chiamata ?? null,
  livello_soddisfazione: row?.livello_soddisfazione ?? null,
  note_chiamata: row?.note_chiamata ?? null,
  data_chiamata: row?.data_chiamata ?? null,
  data_completamento: row?.data_completamento ?? null,
  archiviato: row?.archiviato ?? null,
  orario_richiamata_da: row?.orario_richiamata_da ?? null,
  orario_richiamata_a: row?.orario_richiamata_a ?? null,
  categoria_cliente: row?.categoria_cliente ?? null,
  crea_errore: row?.crea_errore ?? null,
  origine: row?.origine ?? null,
  motivo_urgenza: row?.motivo_urgenza ?? null,
  scheduled_at: row?.scheduled_at ?? null,
  potenziale_ambassador: row?.potenziale_ambassador ?? null,
  motivo_ambassador: row?.motivo_ambassador ?? null,
  problema_risolto: row?.problema_risolto ?? null,
  richiesta_recensione_google: row?.richiesta_recensione_google ?? null,
  link_recensione_inviato: row?.link_recensione_inviato ?? null,
})

function generateAmbassadorCode(cognome: string): string {
  const base = cognome
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z]/g, '')
    .substring(0, 10)

  const random = Math.floor(Math.random() * 900) + 100
  return `${base}${random}-AMB`
}

// PATCH - Aggiorna stato chiamata
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id } = await params
    const updateData = await request.json()

    // Verifica autenticazione
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const { data: existingCall, error: fetchError } = await supabase
      .from('follow_up_chiamate')
      .select(`
        id,
        busta_id,
        stato_chiamata,
        livello_soddisfazione,
        note_chiamata,
        data_chiamata,
        data_completamento,
        archiviato,
        orario_richiamata_da,
        orario_richiamata_a,
        categoria_cliente,
        crea_errore,
        origine,
        motivo_urgenza,
        scheduled_at,
        potenziale_ambassador,
        motivo_ambassador,
        problema_risolto,
        richiesta_recensione_google,
        link_recensione_inviato
      `)
      .eq('id', id)
      .single()

    if (fetchError || !existingCall) {
      console.error('Follow-up call not found for audit:', fetchError)
      return NextResponse.json({ error: 'Chiamata non trovata' }, { status: 404 })
    }

    // Prepara i dati per l'aggiornamento
    const now = new Date().toISOString()
    const patch: any = {
      ...updateData,
      operatore_id: user.id,
      updated_at: now
    }

    // Se la chiamata viene completata, imposta data_chiamata e data_completamento
    if (updateData.stato_chiamata && [
      'chiamato_completato',
      'non_vuole_essere_contattato',
      'numero_sbagliato'
    ].includes(updateData.stato_chiamata)) {
      patch.data_chiamata = now
      patch.data_completamento = now.split('T')[0] // Solo la data

      // ✅ AUTO-ADD NOTES for specific states
      if (updateData.stato_chiamata === 'non_vuole_essere_contattato') {
        const autoNote = 'Il cliente chiede di non essere disturbato.'
        patch.note_chiamata = updateData.note_chiamata
          ? `${updateData.note_chiamata}\n${autoNote}`
          : autoNote
      } else if (updateData.stato_chiamata === 'numero_sbagliato') {
        const autoNote = 'Numero di telefono errato, impossibile contattare il cliente.'
        patch.note_chiamata = updateData.note_chiamata
          ? `${updateData.note_chiamata}\n${autoNote}`
          : autoNote
      }
    }

    // Se è "richiamami", rimuovi la data di completamento
    if (updateData.stato_chiamata === 'richiamami') {
      patch.data_completamento = null
    }

    // FU2.0: Auto-categorize customer based on call outcome
    // Check both the update payload and existing state for stato_chiamata
    const finalStato = updateData.stato_chiamata || existingCall.stato_chiamata;
    const finalOrigine = updateData.origine || existingCall.origine;

    // Categorize if:
    // 1. Satisfaction level is being set (for completed calls)
    // 2. OR stato_chiamata indicates a terminal state (perso, non_risponde, etc.)
    const terminalStates = ['chiamato_completato', 'non_vuole_essere_contattato', 'numero_sbagliato'];
    const shouldCategorize =
      (updateData.livello_soddisfazione && finalStato === 'chiamato_completato') ||
      (updateData.stato_chiamata && terminalStates.includes(updateData.stato_chiamata));

    console.log('🔍 FU2.0 Debug:', {
      has_satisfaction: !!updateData.livello_soddisfazione,
      satisfaction_value: updateData.livello_soddisfazione,
      stato_in_update: updateData.stato_chiamata,
      existing_stato: existingCall.stato_chiamata,
      finalStato,
      shouldCategorize,
    });

    if (shouldCategorize) {
      try {
        // Fetch busta info to get ticket value
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { data: bustaData } = await adminClient
          .from('buste')
          .select(`
            id,
            info_pagamenti:info_pagamenti (
              totale
            )
          `)
          .eq('id', existingCall.busta_id)
          .single()

        const ticketValue = (bustaData?.info_pagamenti as any)?.totale || 0

        // Determine if problem was resolved (not explicitly tracked, use satisfaction as proxy)
        const problema_risolto =
          updateData.livello_soddisfazione === 'molto_soddisfatto' ||
          updateData.livello_soddisfazione === 'soddisfatto'

        // Calculate category
        const categoria = categorizeCustomer({
          soddisfazione: updateData.livello_soddisfazione as LivelloSoddisfazione | undefined,
          stato_chiamata: finalStato as any,
          ticket_value: ticketValue,
          note_chiamata: patch.note_chiamata || existingCall.note_chiamata,
          problema_risolto,
        })

        if (categoria) {
          patch.categoria_cliente = categoria
          console.log(`✅ FU2.0: Customer categorized as "${categoria}" for follow-up ${id}`)
        }
      } catch (err) {
        console.error('Failed to categorize customer:', err)
        // Don't fail the request - categorization is supplementary
      }
    }

    // Aggiorna il record
    const { data, error } = await supabase
      .from('follow_up_chiamate')
      .update(patch)
      .eq('id', id)
      .select(`
        id,
        busta_id,
        data_generazione,
        data_chiamata,
        operatore_id,
        stato_chiamata,
        livello_soddisfazione,
        note_chiamata,
        motivo_urgenza,
        orario_richiamata_da,
        orario_richiamata_a,
        scheduled_at,
        data_completamento,
        archiviato,
        priorita,
        origine,
        created_at,
        updated_at,
        categoria_cliente,
        crea_errore,
        potenziale_ambassador,
        motivo_ambassador,
        problema_risolto,
        richiesta_recensione_google,
        link_recensione_inviato,
        profiles:profiles!follow_up_chiamate_operatore_id_fkey (
          full_name
        )
      `)
      .single()

    if (error) {
      console.error('Errore aggiornamento chiamata:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const audit = await logUpdate(
      'follow_up_chiamate',
      id,
      user.id,
      pickFollowUpAuditFields(existingCall),
      pickFollowUpAuditFields(data),
      'Aggiornamento chiamata follow-up',
      {
        source: 'api/follow-up/calls/[id]',
        stato_chiamata: data.stato_chiamata
      },
      profile?.role ?? null
    )

    if (!audit.success) {
      console.error('AUDIT_UPDATE_FOLLOWUP_FAILED', audit.error)
    }

    // Ambassador nomination logic
    let ambassadorResult: { activated?: boolean; code?: string; alreadyAmbassador?: boolean } = {}
    if (updateData.potenziale_ambassador === true && data) {
      try {
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Fetch cliente to check existing ambassador status
        const { data: bustaWithCliente } = await adminClient
          .from('buste')
          .select('cliente_id, clienti ( id, cognome, ambassador_code )')
          .eq('id', existingCall.busta_id)
          .single()

        const cliente = bustaWithCliente?.clienti as any
        if (cliente?.ambassador_code) {
          console.log(`Cliente ${cliente.id} già ambassador (codice: ${cliente.ambassador_code})`)
          ambassadorResult = { alreadyAmbassador: true, code: cliente.ambassador_code }
        } else if (cliente && (updateData.livello_soddisfazione === 'molto_soddisfatto' || existingCall.livello_soddisfazione === 'molto_soddisfatto')) {
          const ambassadorCode = generateAmbassadorCode(cliente.cognome || 'CLIENTE')

          const { error: updateClienteError } = await adminClient
            .from('clienti')
            .update({
              is_ambassador: true,
              ambassador_code: ambassadorCode,
              ambassador_activated_at: new Date().toISOString(),
              fonte_ambassador: 'follow_up',
              updated_by: user.id
            })
            .eq('id', cliente.id)

          if (updateClienteError) {
            console.error('Errore attivazione ambassador:', updateClienteError)
          } else {
            ambassadorResult = { activated: true, code: ambassadorCode }

            await logUpdate(
              'clienti',
              cliente.id,
              user.id,
              { is_ambassador: false, ambassador_code: null, fonte_ambassador: null },
              { is_ambassador: true, ambassador_code: ambassadorCode, fonte_ambassador: 'follow_up' },
              'Nomina ambassador da follow-up',
              {
                source: 'follow_up_call',
                follow_up_id: id,
                motivo: updateData.motivo_ambassador
              },
              profile?.role ?? null
            )
            console.log(`✅ Ambassador attivato: ${cliente.cognome} -> ${ambassadorCode}`)
          }
        }
      } catch (ambassadorErr) {
        console.error('Errore gestione ambassador:', ambassadorErr)
      }
    }

    const completedStates = ['chiamato_completato', 'non_vuole_essere_contattato', 'numero_sbagliato']
    if (finalOrigine === 'tecnico' && completedStates.includes(finalStato)) {
      try {
        const completedAt = patch.data_chiamata || now
        const { error: bustaUpdateError } = await supabase
          .from('buste')
          .update({
            richiede_telefonata: true,
            telefonata_completata: true,
            telefonata_completata_data: completedAt,
            telefonata_completata_da: user.id
          })
          .eq('id', existingCall.busta_id)

        if (bustaUpdateError) {
          console.error('Errore aggiornamento busta (telefonata completata):', bustaUpdateError)
        }
      } catch (bustaUpdateErr) {
        console.error('Errore aggiornamento busta (telefonata completata):', bustaUpdateErr)
      }
    }

    return NextResponse.json({
      success: true,
      data,
      ...(ambassadorResult.activated && { ambassador: ambassadorResult })
    })

  } catch (error) {
    console.error('Errore PATCH chiamata:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}

// DELETE - Cancella chiamata (soft delete -> archivia)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id } = await params

    // Verifica autenticazione
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const { data: existingCall, error: fetchError } = await supabase
      .from('follow_up_chiamate')
      .select('id, stato_chiamata, livello_soddisfazione, note_chiamata, data_chiamata, data_completamento, archiviato')
      .eq('id', id)
      .single()

    if (fetchError || !existingCall) {
      console.error('Follow-up call not found for archive:', fetchError)
      return NextResponse.json({ error: 'Chiamata non trovata' }, { status: 404 })
    }

    // Archivia invece di cancellare
    const { error } = await supabase
      .from('follow_up_chiamate')
      .update({
        archiviato: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (error) {
      console.error('Errore archiviazione chiamata:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const updatedSnapshot = {
      ...existingCall,
      archiviato: true
    }

    const auditArchive = await logUpdate(
      'follow_up_chiamate',
      id,
      user.id,
      pickFollowUpAuditFields(existingCall),
      pickFollowUpAuditFields(updatedSnapshot),
      'Archiviazione chiamata follow-up',
      {
        source: 'api/follow-up/calls/[id]',
        action: 'archive'
      },
      profile?.role ?? null
    )

    if (!auditArchive.success) {
      console.error('AUDIT_ARCHIVE_FOLLOWUP_FAILED', auditArchive.error)
    }

    return NextResponse.json({
      success: true,
      message: 'Chiamata archiviata'
    })

  } catch (error) {
    console.error('Errore DELETE chiamata:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}
