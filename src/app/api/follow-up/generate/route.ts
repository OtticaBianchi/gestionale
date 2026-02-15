import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// Tipi lavorazione eligibili per follow-up
const FOLLOW_UP_ELIGIBLE_TYPES = ['OCV', 'OV', 'LAC', 'OS', 'LV', 'LS']

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

    // Recupera le buste già in follow-up ATTIVE per escluderle dalla rigenerazione.
    // In questo modo evitiamo duplicati (es. non_risponde/richiamami) quando si rilancia "Genera Lista".
    const { data: existingFollowUps } = await supabase
      .from('follow_up_chiamate')
      .select('busta_id')
      .or('archiviato.is.null,archiviato.eq.false')

    const existingBusteIds = new Set(existingFollowUps?.map(f => f.busta_id) || [])
    console.log('🚫 DEBUG: Found', existingBusteIds.size, 'active follow-up buste to exclude')

    // Processa i dati manualmente
    const safeData = Array.isArray(fallbackData) ? fallbackData : []
    const processedData = safeData
      .filter(busta => {
        // Esclude tutte le buste già presenti in follow-up attivo per evitare duplicazioni.
        if (existingBusteIds.has(busta.id)) {
          return false
        }

        // Filtra per tipi lavorazione eligibili
        if (!busta.tipo_lavorazione || !FOLLOW_UP_ELIGIBLE_TYPES.includes(busta.tipo_lavorazione)) {
          return false
        }

        // Soglia minima prezzo 100€
        const infoPagamenti = Array.isArray(busta.info_pagamenti) ? busta.info_pagamenti[0] : busta.info_pagamenti
        const prezzoFinale = infoPagamenti?.prezzo_finale || 0
        if (prezzoFinale < 100) {
          return false
        }

        // Verifica che sia almeno 11 giorni fa (già filtrato nella query, ma ricontrolliamo)
        const dataConsegna = new Date(busta.data_completamento_consegna || busta.updated_at || Date.now())
        const giorniTrascorsi = Math.floor((Date.now() - dataConsegna.getTime()) / (1000 * 60 * 60 * 24))

        return giorniTrascorsi >= 11 // Almeno 11 giorni fa
      })
      .map(busta => {
        const cliente = Array.isArray(busta.clienti) ? busta.clienti[0] : busta.clienti
        const infoPagamenti = Array.isArray(busta.info_pagamenti) ? busta.info_pagamenti[0] : busta.info_pagamenti
        const ordiniMateriali = (Array.isArray(busta.ordini_materiali)
          ? busta.ordini_materiali
          : (busta.ordini_materiali ? [busta.ordini_materiali] : [])) as Array<{
          descrizione_prodotto?: string | null
        }>

        const prezzoFinale = infoPagamenti?.prezzo_finale || 0

        // Extract product descriptions from ordini_materiali
        const descrizioniProdotti = ordiniMateriali
          ?.filter(ordine => ordine?.descrizione_prodotto && ordine.descrizione_prodotto.trim() !== '')
          .map(ordine => ordine.descrizione_prodotto)
          .join(', ') || ''

        const priorita = calcolaPriorità(
          prezzoFinale,
          busta.tipo_lavorazione
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

      let insertedCount = 0
      let skippedDuplicateCount = 0
      let insertMode: 'upsert' | 'fallback' | 'error' = 'upsert'

      const { data: upsertedRows, error: upsertError } = await supabase
        .from('follow_up_chiamate')
        .upsert(insertsData, {
          onConflict: 'busta_id',
          ignoreDuplicates: true
        })
        .select('id')

      if (!upsertError) {
        insertedCount = upsertedRows?.length || 0
      } else {
        const errorCode = upsertError.code || ''
        const shouldFallback = errorCode === '42P10' || errorCode === '23505'

        if (!shouldFallback) {
          insertMode = 'error'
          console.error('Errore upsert follow-up:', upsertError)
        } else {
          insertMode = 'fallback'
          console.warn('Upsert non disponibile, fallback a insert controllata:', upsertError)

          for (const row of insertsData) {
            const { error: rowError } = await supabase
              .from('follow_up_chiamate')
              .insert(row)

            if (!rowError) {
              insertedCount += 1
              continue
            }

            if (rowError.code === '23505') {
              skippedDuplicateCount += 1
              continue
            }

            console.error('Errore insert singola follow-up:', rowError)
          }
        }
      }

      console.log('📥 DEBUG: Insert result', {
        attempted: insertsData.length,
        inserted: insertedCount,
        skippedDuplicate: skippedDuplicateCount,
        mode: insertMode
      })
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
  tipoLavorazione: string | null
): 'alta' | 'normale' | 'bassa' {
  if (!tipoLavorazione) return 'bassa'
  const tipo = tipoLavorazione === 'TALAC' ? 'LAC' : tipoLavorazione

  // PRIORITÀ ALTA
  if (prezzoFinale >= 400 && ['OCV', 'OV'].includes(tipo)) return 'alta'
  if (['LAC'].includes(tipo)) return 'alta'
  if (tipo === 'LV' && prezzoFinale >= 100) return 'alta'
  if (['LS', 'OS'].includes(tipo) && prezzoFinale >= 300) return 'alta'

  // PRIORITÀ NORMALE
  if (prezzoFinale >= 100) return 'normale'

  // PRIORITÀ BASSA
  return 'bassa'
}

function getTipoAcquisto(tipoLavorazione: string | null): string {
  const mapping: Record<string, string> = {
    'OCV': 'Occhiali Completi',
    'OV': 'Occhiali da Vista',
    'OS': 'Occhiali da Sole',
    'LAC': 'Lenti a Contatto',
    'TALAC': 'Lenti a Contatto',
    'LV': 'Lenti da Vista',
    'LS': 'Lenti da Sole'
  }
  return mapping[tipoLavorazione || ''] || tipoLavorazione || 'N/A'
}
