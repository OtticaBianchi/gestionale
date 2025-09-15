import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = createServerSupabaseClient()

    // Verifica autenticazione
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Query semplificata per generare lista follow-up
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('buste')
      .select(`
        id,
        cliente_id,
        tipo_lavorazione,
        readable_id,
        updated_at,
        clienti (
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
        )
      `)
      .eq('stato_attuale', 'consegnato_pagato')
      .gte('updated_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .lte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .not('clienti.telefono', 'is', null)
      .neq('clienti.telefono', '')

    if (fallbackError) {
      console.error('Errore query buste elegibili:', fallbackError)
      throw fallbackError
    }

    // Processa i dati manualmente
    const processedData = fallbackData
      ?.filter(busta => {
        // Esclude chi è già stato chiamato (questo controllo andrebbe fatto con una query separata)
        return true // Per ora accettiamo tutti
      })
      .map(busta => {
        const cliente = Array.isArray(busta.clienti) ? busta.clienti[0] : busta.clienti
        const materiali = Array.isArray(busta.materiali) ? busta.materiali : [busta.materiali]
        const infoPagamenti = Array.isArray(busta.info_pagamenti) ? busta.info_pagamenti[0] : busta.info_pagamenti

        const hasPrimoAcquistoLAC = materiali?.some(m =>
          m?.tipo === 'LAC' && m?.primo_acquisto_lac === true
        ) || false

        const prezzoFinale = infoPagamenti?.prezzo_finale || 0

        const priorita = calcolaPriorità(
          prezzoFinale,
          busta.tipo_lavorazione,
          hasPrimoAcquistoLAC
        )

        if (!priorita) return null

        const dataConsegna = new Date(busta.updated_at || Date.now())
        const giorniTrascorsi = Math.floor((Date.now() - dataConsegna.getTime()) / (1000 * 60 * 60 * 24))

        return {
          id: busta.id,
          cliente_id: busta.cliente_id,
          prezzo_finale: prezzoFinale,
          tipo_lavorazione: busta.tipo_lavorazione,
          readable_id: busta.readable_id,
          data_consegna: dataConsegna.toISOString().split('T')[0],
          giorni_trascorsi: giorniTrascorsi,
          cliente_nome: cliente?.nome || '',
          cliente_cognome: cliente?.cognome || '',
          cliente_telefono: cliente?.telefono || '',
          tipo_acquisto: getTipoAcquisto(busta.tipo_lavorazione),
          priorita
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => {
        // Ordina per giorni trascorsi e priorità
        if (a.giorni_trascorsi !== b.giorni_trascorsi) {
          return b.giorni_trascorsi - a.giorni_trascorsi
        }
        const priorityOrder = { alta: 1, normale: 2, bassa: 3 }
        return priorityOrder[a.priorita] - priorityOrder[b.priorita]
      })

    // Inserisci i record nella tabella follow_up_chiamate
    if (processedData.length > 0) {
      const insertsData = processedData.map(item => ({
        busta_id: item.id,
        data_generazione: new Date().toISOString().split('T')[0],
        priorita: item.priorita,
        stato_chiamata: 'da_chiamare'
      }))

      const { error: insertError } = await supabase
        .from('follow_up_chiamate')
        .insert(insertsData)

      if (insertError) {
        console.error('Errore inserimento follow-up:', insertError)
        // Non blocchiamo, restituiamo comunque i dati
      }
    }

    return NextResponse.json({
      success: true,
      count: processedData.length,
      data: processedData
    })

  } catch (error) {
    console.error('Errore generazione lista follow-up:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}

// Funzioni helper
function calcolaPriorità(
  prezzoFinale: number,
  tipoLavorazione: string | null,
  haPrimoAcquistoLAC: boolean
): 'alta' | 'normale' | 'bassa' | null {
  if (!tipoLavorazione) return null

  // PRIORITÀ ALTA: Lenti + Occhiali sopra 400€
  if (prezzoFinale >= 400 && ['OCV', 'OV'].includes(tipoLavorazione)) {
    return 'alta'
  }

  // PRIORITÀ NORMALE: Prime LAC o Lenti da vista sopra 100€
  if (haPrimoAcquistoLAC || (prezzoFinale >= 100 && tipoLavorazione === 'LV')) {
    return 'normale'
  }

  // PRIORITÀ BASSA: Occhiali da sole sopra 400€
  if (prezzoFinale >= 400 && tipoLavorazione === 'OS') {
    return 'bassa'
  }

  return null
}

function getTipoAcquisto(tipoLavorazione: string | null): string {
  const mapping: Record<string, string> = {
    'OCV': 'Occhiali Completi',
    'OV': 'Occhiali da Vista',
    'OS': 'Occhiali da Sole',
    'LAC': 'Lenti a Contatto',
    'LV': 'Lenti da Vista'
  }
  return mapping[tipoLavorazione || ''] || tipoLavorazione || 'N/A'
}