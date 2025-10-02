import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

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
        profiles (
          full_name
        )
      `)
      .single()

    if (error) {
      console.error('Errore aggiornamento chiamata:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
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
