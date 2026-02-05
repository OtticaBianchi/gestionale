import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()

    // Verifica autenticazione
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Query per generare lista follow-up - cerca buste consegnate da almeno 11 giorni
    // Evita i primi 11 giorni per dare tempo di risolvere eventuali problemi immediati
    console.log('🔍 DEBUG: Starting follow-up generation...')

    const elevenDaysAgo = new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString()
    console.log('📅 DEBUG: Looking for buste delivered on or before:', elevenDaysAgo)

    let fallbackData: any[] | null = null
    let fallbackError: { message?: string } | null = null

    const { data: initialData, error: initialError } = await supabase
      .from('buste')
      .select(`
        id,
        cliente_id,
        tipo_lavorazione,
        readable_id,
        data_completamento_consegna,
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
        ),
        ordini_materiali (
          descrizione_prodotto
        )
      `)
      .eq('stato_attuale', 'consegnato_pagato')
      .lte('data_completamento_consegna', elevenDaysAgo)
      .not('data_completamento_consegna', 'is', null)
      .not('clienti.telefono', 'is', null)
      .neq('clienti.telefono', '')

    if (initialError) {
      console.error('❌ ERROR: Primary query failed, fallback to updated_at:', initialError)
      const { data: retryData, error: retryError } = await supabase
        .from('buste')
        .select(`
          id,
          cliente_id,
          tipo_lavorazione,
          readable_id,
          data_completamento_consegna,
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
          ),
          ordini_materiali (
            descrizione_prodotto
          )
        `)
        .eq('stato_attuale', 'consegnato_pagato')
        .lte('updated_at', elevenDaysAgo)
        .not('clienti.telefono', 'is', null)
        .neq('clienti.telefono', '')

      fallbackData = retryData
      fallbackError = retryError
    } else {
      fallbackData = initialData
      fallbackError = initialError
    }

    console.log('📊 DEBUG: Query completed. Error:', fallbackError)
    console.log('📊 DEBUG: Raw query results count:', fallbackData?.length || 0)

    if (fallbackError) {
      console.error('❌ ERROR: Query failed:', fallbackError)
      return NextResponse.json(
        { success: false, error: fallbackError.message || 'Query failed' },
        { status: 200 }
      )
    }

    if (!fallbackData || fallbackData.length === 0) {
      console.log('⚠️ DEBUG: No buste found matching criteria')
      console.log('🔍 DEBUG: Search criteria:')
      console.log('  - stato_attuale: consegnato_pagato')
      console.log('  - data_completamento_consegna on or before ', elevenDaysAgo)
      console.log('  - clienti.telefono is not null and not empty')
    } else {
      console.log('✅ DEBUG: Found', fallbackData.length, 'potential buste')
      console.log('📋 DEBUG: Sample busta:', JSON.stringify(fallbackData[0], null, 2))
    }

    // Recupera le buste già in follow-up per escluderle
    // Stati che NON devono riapparire: da_chiamare, chiamato_completato, non_vuole_essere_contattato, numero_sbagliato
    // Stati che devono continuare ad apparire: non_risponde, richiamami (cliente temporaneamente non disponibile)
    const { data: existingFollowUps } = await supabase
      .from('follow_up_chiamate')
      .select('busta_id')
      .in('stato_chiamata', ['da_chiamare', 'chiamato_completato', 'non_vuole_essere_contattato', 'numero_sbagliato'])

    const existingBusteIds = new Set(existingFollowUps?.map(f => f.busta_id) || [])
    console.log('🚫 DEBUG: Found', existingBusteIds.size, 'buste with final/completed states to exclude')

    // Processa i dati manualmente
    const safeData = Array.isArray(fallbackData) ? fallbackData : []
    const processedData = safeData
      .filter(busta => {
        // Esclude buste già presenti con stati: da_chiamare, chiamato_completato, non_vuole_essere_contattato, numero_sbagliato
        // Le buste con stati temporanei (non_risponde, richiamami) continuano ad apparire perché il cliente potrebbe rispondere successivamente
        if (existingBusteIds.has(busta.id)) {
          return false
        }

        // Verifica che sia almeno 11 giorni fa (già filtrato nella query, ma ricontrolliamo)
        const dataConsegna = new Date(busta.data_completamento_consegna || busta.updated_at || Date.now())
        const giorniTrascorsi = Math.floor((Date.now() - dataConsegna.getTime()) / (1000 * 60 * 60 * 24))

        return giorniTrascorsi >= 11 // Almeno 11 giorni fa
      })
      .map(busta => {
        const cliente = Array.isArray(busta.clienti) ? busta.clienti[0] : busta.clienti
        const materiali = (Array.isArray(busta.materiali) ? busta.materiali : [busta.materiali]) as Array<{
          tipo?: string | null
          primo_acquisto_lac?: boolean | null
        }>
        const infoPagamenti = Array.isArray(busta.info_pagamenti) ? busta.info_pagamenti[0] : busta.info_pagamenti
        const ordiniMateriali = (Array.isArray(busta.ordini_materiali)
          ? busta.ordini_materiali
          : (busta.ordini_materiali ? [busta.ordini_materiali] : [])) as Array<{
          descrizione_prodotto?: string | null
        }>

        const hasPrimoAcquistoLAC = materiali?.some(m =>
          m?.tipo === 'LAC' && m?.primo_acquisto_lac === true
        ) || false

        const prezzoFinale = infoPagamenti?.prezzo_finale || 0

        // Extract product descriptions from ordini_materiali
        const descrizioniProdotti = ordiniMateriali
          ?.filter(ordine => ordine?.descrizione_prodotto && ordine.descrizione_prodotto.trim() !== '')
          .map(ordine => ordine.descrizione_prodotto)
          .join(', ') || ''

        const priorita = calcolaPriorità(
          prezzoFinale,
          busta.tipo_lavorazione,
          hasPrimoAcquistoLAC
        )
        const dataConsegna = new Date(busta.data_completamento_consegna || busta.updated_at || Date.now())
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
          descrizione_prodotti: descrizioniProdotti,
          priorita
        }
      })
      .sort((a, b) => {
        // PRIORITÀ 1: Giorni trascorsi (più vecchi prima)
        if (a.giorni_trascorsi !== b.giorni_trascorsi) {
          return b.giorni_trascorsi - a.giorni_trascorsi // Più vecchi per primi
        }
        // PRIORITÀ 2: Livello di priorità del cliente
        const priorityOrder = { alta: 1, normale: 2, bassa: 3 }
        return priorityOrder[a.priorita] - priorityOrder[b.priorita]
      })

    // Inserisci i record nella tabella follow_up_chiamate
    if (processedData.length > 0) {
      const insertsData = processedData.map(item => ({
        busta_id: item.id,
        data_generazione: new Date().toISOString().split('T')[0],
        priorita: item.priorita,
        stato_chiamata: 'da_chiamare',
        origine: 'post_vendita'
      }))

      const { error: insertError } = await supabase
        .from('follow_up_chiamate')
        .insert(insertsData)

      if (insertError) {
        console.error('Errore inserimento follow-up:', insertError)
        // Non blocchiamo, restituiamo comunque i dati
      }
    }

    console.log('🎯 DEBUG: Final processed data count:', processedData.length)
    console.log('📤 DEBUG: Returning response with', processedData.length, 'follow-up entries')

    return NextResponse.json({
      success: true,
      count: processedData.length,
      data: processedData,
      debug: {
        rawQueryCount: fallbackData?.length || 0,
        excludedCount: existingBusteIds.size,
        finalCount: processedData.length,
        searchDateRange: `<= ${elevenDaysAgo}`,
        dayRange: '11+ days ago'
      }
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
): 'alta' | 'normale' | 'bassa' {
  if (!tipoLavorazione) return 'bassa'

  // PRIORITÀ ALTA: Lenti + Occhiali sopra 400€
  if (prezzoFinale >= 400 && ['OCV', 'OV'].includes(tipoLavorazione)) {
    return 'alta'
  }

  // PRIORITÀ NORMALE: Prime LAC, Lenti da vista sopra 100€, o Occhiali Completi/Vista sopra 200€
  if (haPrimoAcquistoLAC ||
      (prezzoFinale >= 100 && tipoLavorazione === 'LV') ||
      (prezzoFinale >= 200 && ['OCV', 'OV'].includes(tipoLavorazione))) {
    return 'normale'
  }

  // PRIORITÀ BASSA: Occhiali da sole sopra 400€, o qualsiasi altro acquisto sopra 100€
  if ((prezzoFinale >= 400 && tipoLavorazione === 'OS') ||
      (prezzoFinale >= 100)) {
    return 'bassa'
  }

  return 'bassa'
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
