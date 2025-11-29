import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logUpdate } from '@/lib/audit/auditLog'

const pickFollowUpAuditFields = (row: any) => ({
  stato_chiamata: row?.stato_chiamata ?? null,
  livello_soddisfazione: row?.livello_soddisfazione ?? null,
  note_chiamata: row?.note_chiamata ?? null,
  data_chiamata: row?.data_chiamata ?? null,
  data_completamento: row?.data_completamento ?? null,
  archiviato: row?.archiviato ?? null,
  orario_richiamata_da: row?.orario_richiamata_da ?? null,
  orario_richiamata_a: row?.orario_richiamata_a ?? null
})

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
      .select('id, stato_chiamata, livello_soddisfazione, note_chiamata, data_chiamata, data_completamento, archiviato, orario_richiamata_da, orario_richiamata_a')
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
        orario_richiamata_da,
        orario_richiamata_a,
        data_completamento,
        archiviato,
        priorita,
        created_at,
        updated_at,
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

    return NextResponse.json({
      success: true,
      data
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
