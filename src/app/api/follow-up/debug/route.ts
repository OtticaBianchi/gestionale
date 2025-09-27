import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// DEBUG endpoint to inspect database state for follow-up generation
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    // Verifica autenticazione
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔍 DEBUG ENDPOINT: Starting database inspection...')

    // 1. Check total buste count
    const { count: totalBuste } = await supabase
      .from('buste')
      .select('*', { count: 'exact', head: true })

    // 2. Check buste by state
    const { data: stateBreakdown } = await supabase
      .from('buste')
      .select('stato_attuale')

    const stateCounts = stateBreakdown?.reduce((acc, busta) => {
      acc[busta.stato_attuale] = (acc[busta.stato_attuale] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // 3. Check consegnato_pagato buste
    const { data: consegnatoBuste, count: consegnatoCount } = await supabase
      .from('buste')
      .select('id, readable_id, updated_at, cliente_id', { count: 'exact' })
      .eq('stato_attuale', 'consegnato_pagato')

    // 4. Check recent consegnato_pagato (last 30 days for broader view)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const eighteenDaysAgo = new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString()
    const elevenDaysAgo = new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString()

    const { data: recentBuste, count: recentCount } = await supabase
      .from('buste')
      .select('id, readable_id, updated_at, cliente_id', { count: 'exact' })
      .eq('stato_attuale', 'consegnato_pagato')
      .gte('updated_at', thirtyDaysAgo)

    const { data: eighteenDayBuste, count: eighteenDayCount } = await supabase
      .from('buste')
      .select('id, readable_id, updated_at, cliente_id', { count: 'exact' })
      .eq('stato_attuale', 'consegnato_pagato')
      .gte('updated_at', eighteenDaysAgo)

    // 5. Check clienti with phone numbers
    const { count: clientiWithPhone } = await supabase
      .from('clienti')
      .select('*', { count: 'exact', head: true })
      .not('telefono', 'is', null)
      .neq('telefono', '')

    // 6. Check full follow-up eligible query (without phone filter first)
    const { data: eligibleWithoutPhone, count: eligibleWithoutPhoneCount } = await supabase
      .from('buste')
      .select('id, readable_id, updated_at, cliente_id', { count: 'exact' })
      .eq('stato_attuale', 'consegnato_pagato')
      .gte('updated_at', eighteenDaysAgo)
      .lte('updated_at', elevenDaysAgo)

    // 7. Check with phone filter
    const { data: eligibleWithPhone, count: eligibleWithPhoneCount } = await supabase
      .from('buste')
      .select(`
        id,
        readable_id,
        updated_at,
        cliente_id,
        clienti (
          nome,
          cognome,
          telefono
        )
      `, { count: 'exact' })
      .eq('stato_attuale', 'consegnato_pagato')
      .gte('updated_at', eighteenDaysAgo)
      .lte('updated_at', elevenDaysAgo)
      .not('clienti.telefono', 'is', null)
      .neq('clienti.telefono', '')

    // 8. Check existing follow-ups
    const { count: existingFollowUps } = await supabase
      .from('follow_up_chiamate')
      .select('*', { count: 'exact', head: true })

    // 9. Sample some recent buste for inspection
    const { data: sampleBuste } = await supabase
      .from('buste')
      .select(`
        id,
        readable_id,
        updated_at,
        stato_attuale,
        cliente_id,
        clienti (
          nome,
          cognome,
          telefono
        ),
        info_pagamenti (
          prezzo_finale
        )
      `)
      .eq('stato_attuale', 'consegnato_pagato')
      .order('updated_at', { ascending: false })
      .limit(5)

    const debugData = {
      timestamp: new Date().toISOString(),
      searchDates: {
        thirtyDaysAgo,
        eighteenDaysAgo,
        elevenDaysAgo,
        today: new Date().toISOString()
      },
      counts: {
        totalBuste,
        consegnatoPagatoBuste: consegnatoCount,
        recentConsegnato30Days: recentCount,
        recentConsegnato18Days: eighteenDayCount,
        clientiWithValidPhone: clientiWithPhone,
        eligibleWithoutPhoneFilter: eligibleWithoutPhoneCount,
        eligibleWithPhoneFilter: eligibleWithPhoneCount,
        existingFollowUps
      },
      stateBreakdown: stateCounts,
      sampleRecentBuste: sampleBuste?.slice(0, 3), // Show only first 3 for brevity
      eligibleSample: eligibleWithPhone?.slice(0, 3), // Show eligible buste sample
      analysis: {
        hasConsegnatoBuste: (consegnatoCount || 0) > 0,
        hasRecentBuste: (eighteenDayCount || 0) > 0,
        hasEligibleBuste: (eligibleWithPhoneCount || 0) > 0,
        phoneFilterImpact: (eligibleWithoutPhoneCount || 0) - (eligibleWithPhoneCount || 0)
      }
    }

    console.log('📊 DEBUG INSPECTION RESULTS:', JSON.stringify(debugData, null, 2))

    return NextResponse.json({
      success: true,
      debug: debugData
    })

  } catch (error) {
    console.error('❌ DEBUG ENDPOINT ERROR:', error)
    return NextResponse.json(
      { error: 'Debug inspection failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
