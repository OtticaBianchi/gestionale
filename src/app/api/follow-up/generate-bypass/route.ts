import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// BYPASS endpoint for testing follow-up generation with minimal filters
export async function POST() {
  try {
    // Endpoint di diagnostica: non deve essere disponibile in produzione.
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const supabase = await createServerSupabaseClient()

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

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    console.log('🚀 BYPASS: Starting minimal follow-up generation...')

    // STEP 1: Get ANY consegnato_pagato buste (no time filter)
    console.log('📋 BYPASS: Step 1 - Get all consegnato_pagato buste...')
    const { data: allConsegnato, error: step1Error } = await supabase
      .from('buste')
      .select(`
        id,
        cliente_id,
        tipo_lavorazione,
        readable_id,
        updated_at
      `)
      .eq('stato_attuale', 'consegnato_pagato')
      .limit(10) // Limit to avoid overwhelming

    console.log('📊 BYPASS: Step 1 results:', {
      error: step1Error,
      count: allConsegnato?.length || 0,
      sample: allConsegnato?.[0]
    })

    if (step1Error) {
      return NextResponse.json({ error: 'Step 1 failed', details: step1Error })
    }

    if (!allConsegnato || allConsegnato.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No buste found in consegnato_pagato state',
        step: 'step1_no_results'
      })
    }

    // STEP 2: Get clienti data for these buste
    console.log('📋 BYPASS: Step 2 - Get clienti data...')
    const busteIds = allConsegnato.map(b => b.id)

    const { data: busteWithClienti, error: step2Error } = await supabase
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
        )
      `)
      .in('id', busteIds)

    console.log('📊 BYPASS: Step 2 results:', {
      error: step2Error,
      count: busteWithClienti?.length || 0,
      sample: busteWithClienti?.[0]
    })

    if (step2Error) {
      return NextResponse.json({ error: 'Step 2 failed', details: step2Error })
    }

    // STEP 3: Filter for valid phone numbers
    console.log('📋 BYPASS: Step 3 - Filter by valid phone numbers...')
    const busteWithValidPhone = busteWithClienti?.filter(busta => {
      const cliente = Array.isArray(busta.clienti) ? busta.clienti[0] : busta.clienti
      const hasPhone = cliente?.telefono && cliente.telefono.trim() !== ''

      if (!hasPhone) {
        console.log(`📞 BYPASS: Busta ${busta.readable_id} excluded - no valid phone`)
      }

      return hasPhone
    }) || []

    console.log('📊 BYPASS: Step 3 results:', {
      count: busteWithValidPhone.length,
      sample: busteWithValidPhone[0]
    })

    // STEP 4: Get payment info
    console.log('📋 BYPASS: Step 4 - Get payment info...')
    const validBusteIds = busteWithValidPhone.map(b => b.id)

    const { data: busteWithPayments, error: step4Error } = await supabase
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
        info_pagamenti (
          prezzo_finale
        ),
        materiali (
          tipo,
          primo_acquisto_lac
        )
      `)
      .in('id', validBusteIds)

    console.log('📊 BYPASS: Step 4 results:', {
      error: step4Error,
      count: busteWithPayments?.length || 0
    })

    if (step4Error) {
      return NextResponse.json({ error: 'Step 4 failed', details: step4Error })
    }

    // STEP 5: Process into follow-up format (minimal processing)
    console.log('📋 BYPASS: Step 5 - Process data...')
    const processedData = busteWithPayments?.map(busta => {
      const cliente = Array.isArray(busta.clienti) ? busta.clienti[0] : busta.clienti
      const infoPagamenti = Array.isArray(busta.info_pagamenti) ? busta.info_pagamenti[0] : busta.info_pagamenti
      const materiali = Array.isArray(busta.materiali) ? busta.materiali : [busta.materiali]

      const prezzoFinale = infoPagamenti?.prezzo_finale || 0
      const hasPrimoAcquistoLAC = materiali?.some(m => m?.tipo === 'LAC' && m?.primo_acquisto_lac === true) || false

      // Simple priority calculation using same logic as main endpoint
      let priorita: 'alta' | 'normale' | 'bassa' = 'bassa'

      // PRIORITÀ ALTA: Lenti + Occhiali sopra 400€
      const tipo = busta.tipo_lavorazione === 'TALAC' ? 'LAC' : busta.tipo_lavorazione || ''

      if (prezzoFinale >= 400 && ['OCV', 'OV'].includes(tipo)) {
        priorita = 'alta'
      }
      // PRIORITÀ NORMALE: Prime LAC, Lenti da vista sopra 100€, o Occhiali Completi/Vista sopra 200€
      else if (hasPrimoAcquistoLAC ||
          (prezzoFinale >= 100 && tipo === 'LV') ||
          (prezzoFinale >= 200 && ['OCV', 'OV'].includes(tipo))) {
        priorita = 'normale'
      }
      // PRIORITÀ BASSA: Occhiali da sole sopra 400€, o qualsiasi altro acquisto sopra 100€
      else if ((prezzoFinale >= 400 && tipo === 'OS') ||
          (prezzoFinale >= 100)) {
        priorita = 'bassa'
      }

      return {
        id: busta.id,
        readable_id: busta.readable_id,
        cliente_nome: cliente?.nome || '',
        cliente_cognome: cliente?.cognome || '',
        cliente_telefono: cliente?.telefono || '',
        prezzo_finale: prezzoFinale,
        tipo_lavorazione: busta.tipo_lavorazione,
        updated_at: busta.updated_at,
        priorita,
        giorni_trascorsi: Math.floor((Date.now() - new Date(busta.updated_at || Date.now()).getTime()) / (1000 * 60 * 60 * 24))
      }
    }) || []

    console.log('📊 BYPASS: Step 5 results:', {
      count: processedData.length,
      sample: processedData[0]
    })

    // STEP 6: Insert into follow_up_chiamate (if any results)
    if (processedData.length > 0) {
      console.log('📋 BYPASS: Step 6 - Insert follow-up records...')
      const insertsData = processedData.slice(0, 3).map(item => ({ // Only insert first 3 for testing
        busta_id: item.id,
        data_generazione: new Date().toISOString().split('T')[0],
        priorita: item.priorita,
        stato_chiamata: 'da_chiamare',
        origine: 'post_vendita'
      }))

      const { error: insertError } = await supabase
        .from('follow_up_chiamate')
        .insert(insertsData)

      console.log('📊 BYPASS: Step 6 results:', {
        error: insertError,
        insertCount: insertsData.length
      })

      if (insertError) {
        console.error('⚠️ BYPASS: Insert failed but continuing:', insertError)
      }
    }

    return NextResponse.json({
      success: true,
      bypass: true,
      steps: {
        step1_all_consegnato: allConsegnato?.length || 0,
        step2_with_clienti: busteWithClienti?.length || 0,
        step3_valid_phone: busteWithValidPhone.length,
        step4_with_payments: busteWithPayments?.length || 0,
        step5_processed: processedData.length
      },
      data: processedData.slice(0, 5), // Return first 5 for inspection
      message: processedData.length > 0
        ? `Found ${processedData.length} potential follow-ups`
        : 'No eligible buste found even with bypass filters'
    })

  } catch (error) {
    console.error('❌ BYPASS ERROR:', error)
    return NextResponse.json(
      { error: 'Bypass generation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
