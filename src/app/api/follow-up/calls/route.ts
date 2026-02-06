import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// GET - Recupera lista chiamate correnti
export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const includeArchived = searchParams.get('archived') === 'true'
    const includeCompleted = searchParams.get('completed') === 'true'

    // Verifica autenticazione
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Query per ottenere chiamate con dati correlati
    let query = supabase
      .from('follow_up_chiamate')
      .select(`
        id,
        busta_id,
        data_generazione,
        data_chiamata,
        operatore_id,
        stato_chiamata,
        livello_soddisfazione,
        categoria_cliente,
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
        buste!inner (
          id,
          cliente_id,
          readable_id,
          updated_at,
          tipo_lavorazione,
          clienti!inner (
            nome,
            cognome,
            telefono
          ),
          materiali (
            tipo,
            primo_acquisto_lac
          ),
          info_pagamenti (
            prezzo_finale
          ),
          ordini_materiali (
            descrizione_prodotto
          )
        ),
        profiles:profiles!follow_up_chiamate_operatore_id_fkey (
          full_name
        )
      `)
      .order('priorita', { ascending: true })
      .order('data_generazione', { ascending: false })

    if (!includeArchived) {
      query = query.eq('archiviato', false)
    }

    // Filter out completed calls from the active list unless explicitly requested
    if (!includeCompleted) {
      const completedStates = ['chiamato_completato', 'non_vuole_essere_contattato', 'numero_sbagliato']
      query = query.not('stato_chiamata', 'in', `(${completedStates.join(',')})`)
    }

    const { data: chiamate, error } = await query

    if (error) {
      console.error('Errore recupero chiamate:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Processa i dati per il frontend
    const processedCalls = chiamate?.map(chiamata => {
      const busta = chiamata.buste
      const cliente = busta.clienti
      const dataConsegna = new Date(busta.updated_at || Date.now())
      const giorniTrascorsi = Math.floor((Date.now() - dataConsegna.getTime()) / (1000 * 60 * 60 * 24))

      // Determina tipo acquisto
      const hasPrimoAcquistoLAC = busta.materiali?.some(m =>
        m.tipo === 'LAC' && m.primo_acquisto_lac === true
      )

      let tipoAcquisto = getTipoAcquisto(busta.tipo_lavorazione)
      if (hasPrimoAcquistoLAC) {
        tipoAcquisto = 'Prime Lenti a Contatto'
      }

      // Extract product descriptions from ordini_materiali
      const ordiniMateriali = Array.isArray(busta.ordini_materiali) ? busta.ordini_materiali : (busta.ordini_materiali ? [busta.ordini_materiali] : [])
      const descrizioniProdotti = ordiniMateriali
        ?.filter(ordine => ordine?.descrizione_prodotto && ordine.descrizione_prodotto.trim() !== '')
        .map(ordine => ordine.descrizione_prodotto)
        .join(', ') || ''

      return {
        id: chiamata.id,
        busta_id: chiamata.busta_id,
        data_generazione: chiamata.data_generazione,
        data_chiamata: chiamata.data_chiamata,
        operatore_id: chiamata.operatore_id,
        stato_chiamata: chiamata.stato_chiamata,
        livello_soddisfazione: chiamata.livello_soddisfazione,
        note_chiamata: chiamata.note_chiamata,
        motivo_urgenza: chiamata.motivo_urgenza,
        orario_richiamata_da: chiamata.orario_richiamata_da,
        orario_richiamata_a: chiamata.orario_richiamata_a,
        scheduled_at: chiamata.scheduled_at,
        data_completamento: chiamata.data_completamento,
        archiviato: chiamata.archiviato,
        priorita: chiamata.priorita,
        origine: chiamata.origine,
        created_at: chiamata.created_at,
        updated_at: chiamata.updated_at,
        cliente_nome: cliente.nome,
        cliente_cognome: cliente.cognome,
        cliente_telefono: cliente.telefono,
        tipo_acquisto: tipoAcquisto,
        prezzo_finale: (Array.isArray(busta.info_pagamenti) ? busta.info_pagamenti[0]?.prezzo_finale : busta.info_pagamenti?.prezzo_finale) || 0,
        giorni_trascorsi: giorniTrascorsi,
        readable_id: busta.readable_id,
        operatore_nome: chiamata.profiles?.full_name,
        descrizione_prodotti: descrizioniProdotti
      }
    }) || []

    return NextResponse.json({
      success: true,
      data: processedCalls
    })

  } catch (error) {
    console.error('Errore GET chiamate:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}

function getTipoAcquisto(tipoLavorazione: string | null): string {
  const mapping: Record<string, string> = {
    'OCV': 'Occhiali Completi',
    'OV': 'Occhiali da Vista',
    'OS': 'Occhiali da Sole',
    'LAC': 'Lenti a Contatto',
    'TALAC': 'Lenti a Contatto',
    'LV': 'Lenti da Vista'
  }
  return mapping[tipoLavorazione || ''] || tipoLavorazione || 'N/A'
}
