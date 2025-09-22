import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    // Parameters for flexible time aggregation
    const timeView = searchParams.get('time_view') || 'day' // day, week, month, quarter, semester, year
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const operatorId = searchParams.get('operator_id') // null = all operators
    const groupBy = searchParams.get('group_by') || 'operator' // operator, date, both

    // Verifica autenticazione
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Build aggregation query based on time view
    let dateGrouping: string
    let orderBy: string

    switch (timeView) {
      case 'week':
        dateGrouping = `DATE_TRUNC('week', data_riferimento) as periodo`
        orderBy = 'periodo DESC'
        break
      case 'month':
        dateGrouping = `DATE_TRUNC('month', data_riferimento) as periodo`
        orderBy = 'periodo DESC'
        break
      case 'quarter':
        dateGrouping = `DATE_TRUNC('quarter', data_riferimento) as periodo`
        orderBy = 'periodo DESC'
        break
      case 'semester':
        dateGrouping = `
          CASE
            WHEN EXTRACT(MONTH FROM data_riferimento) <= 6
            THEN DATE_TRUNC('year', data_riferimento) + INTERVAL '0 months'
            ELSE DATE_TRUNC('year', data_riferimento) + INTERVAL '6 months'
          END as periodo
        `
        orderBy = 'periodo DESC'
        break
      case 'year':
        dateGrouping = `DATE_TRUNC('year', data_riferimento) as periodo`
        orderBy = 'periodo DESC'
        break
      default: // day
        dateGrouping = `data_riferimento as periodo`
        orderBy = 'periodo DESC'
        break
    }

    // Build SELECT and GROUP BY based on groupBy parameter
    let selectFields: string
    let groupByClause: string

    if (groupBy === 'date') {
      // Group only by date (aggregate all operators)
      selectFields = `
        ${dateGrouping},
        NULL as operatore_id,
        'Tutti gli Operatori' as operatore_nome,
        SUM(chiamate_totali) as chiamate_totali,
        SUM(chiamate_completate) as chiamate_completate,
        SUM(molto_soddisfatti) as molto_soddisfatti,
        SUM(soddisfatti) as soddisfatti,
        SUM(poco_soddisfatti) as poco_soddisfatti,
        SUM(insoddisfatti) as insoddisfatti,
        SUM(non_vuole_contatto) as non_vuole_contatto,
        SUM(numeri_sbagliati) as numeri_sbagliati,
        SUM(cellulari_staccati) as cellulari_staccati,
        SUM(non_risponde) as non_risponde,
        SUM(da_richiamare) as da_richiamare
      `
      groupByClause = `GROUP BY periodo`
    } else if (groupBy === 'operator') {
      // Group only by operator (aggregate all dates in range)
      selectFields = `
        NULL as periodo,
        operatore_id,
        p.full_name as operatore_nome,
        SUM(chiamate_totali) as chiamate_totali,
        SUM(chiamate_completate) as chiamate_completate,
        SUM(molto_soddisfatti) as molto_soddisfatti,
        SUM(soddisfatti) as soddisfatti,
        SUM(poco_soddisfatti) as poco_soddisfatti,
        SUM(insoddisfatti) as insoddisfatti,
        SUM(non_vuole_contatto) as non_vuole_contatto,
        SUM(numeri_sbagliati) as numeri_sbagliati,
        SUM(cellulari_staccati) as cellulari_staccati,
        SUM(non_risponde) as non_risponde,
        SUM(da_richiamare) as da_richiamare
      `
      groupByClause = `GROUP BY operatore_id, p.full_name`
      orderBy = 'operatore_nome ASC'
    } else {
      // Group by both date and operator
      selectFields = `
        ${dateGrouping},
        operatore_id,
        p.full_name as operatore_nome,
        SUM(chiamate_totali) as chiamate_totali,
        SUM(chiamate_completate) as chiamate_completate,
        SUM(molto_soddisfatti) as molto_soddisfatti,
        SUM(soddisfatti) as soddisfatti,
        SUM(poco_soddisfatti) as poco_soddisfatti,
        SUM(insoddisfatti) as insoddisfatti,
        SUM(non_vuole_contatto) as non_vuole_contatto,
        SUM(numeri_sbagliati) as numeri_sbagliati,
        SUM(cellulari_staccati) as cellulari_staccati,
        SUM(non_risponde) as non_risponde,
        SUM(da_richiamare) as da_richiamare
      `
      groupByClause = `GROUP BY periodo, operatore_id, p.full_name`
      orderBy = 'periodo DESC, operatore_nome ASC'
    }

    // Build WHERE clause
    let whereClause = 'WHERE 1=1'
    if (startDate) {
      whereClause += ` AND data_riferimento >= '${startDate}'`
    }
    if (endDate) {
      whereClause += ` AND data_riferimento <= '${endDate}'`
    }
    if (operatorId) {
      whereClause += ` AND s.operatore_id = '${operatorId}'`
    }

    // Use simplified query approach since custom RPC is not available
    let query = supabase
      .from('statistiche_follow_up')
      .select(`
        *,
        profiles (
          full_name
        )
      `)
      .order('data_riferimento', { ascending: false })

    // Apply filters
    if (startDate) {
      query = query.gte('data_riferimento', startDate)
    }
    if (endDate) {
      query = query.lte('data_riferimento', endDate)
    }
    if (operatorId) {
      query = query.eq('operatore_id', operatorId)
    }

    const { data: rawStatistiche, error } = await query

    if (error) {
      throw error
    }

    // Process and aggregate data client-side
    const processedStats = aggregateStatistics(rawStatistiche || [], timeView, groupBy)

    return NextResponse.json({
      success: true,
      data: processedStats,
      summary: calculateSummary(processedStats),
      timeView,
      groupBy,
      totalRecords: processedStats.length
    })

  } catch (error) {
    console.error('Errore GET statistiche enhanced:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}

// Helper function to aggregate statistics client-side
function aggregateStatistics(rawData: any[], timeView: string, groupBy: string) {
  const grouped = new Map()

  rawData.forEach(stat => {
    const date = new Date(stat.data_riferimento)
    let periodKey: string

    // Determine period grouping
    switch (timeView) {
      case 'week':
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        periodKey = weekStart.toISOString().split('T')[0]
        break
      case 'month':
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        break
      case 'quarter':
        const quarter = Math.floor(date.getMonth() / 3) + 1
        periodKey = `${date.getFullYear()}-Q${quarter}`
        break
      case 'semester':
        const semester = date.getMonth() <= 5 ? 1 : 2
        periodKey = `${date.getFullYear()}-S${semester}`
        break
      case 'year':
        periodKey = date.getFullYear().toString()
        break
      default: // day
        periodKey = stat.data_riferimento
        break
    }

    // Determine grouping key
    let groupKey: string
    if (groupBy === 'date') {
      groupKey = periodKey
    } else if (groupBy === 'operator') {
      groupKey = stat.operatore_id || 'unknown'
    } else {
      groupKey = `${periodKey}-${stat.operatore_id || 'unknown'}`
    }

    // Aggregate data
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        periodo: groupBy !== 'operator' ? periodKey : null,
        periodo_display: groupBy !== 'operator' ? formatPeriod(periodKey, timeView) : null,
        operatore_id: groupBy !== 'date' ? stat.operatore_id : null,
        operatore_nome: groupBy !== 'date' ? stat.profiles?.full_name || 'Sconosciuto' : 'Tutti gli Operatori',
        chiamate_totali: 0,
        chiamate_completate: 0,
        molto_soddisfatti: 0,
        soddisfatti: 0,
        poco_soddisfatti: 0,
        insoddisfatti: 0,
        non_vuole_contatto: 0,
        numeri_sbagliati: 0,
        cellulari_staccati: 0,
        non_risponde: 0,
        da_richiamare: 0
      })
    }

    const group = grouped.get(groupKey)
    group.chiamate_totali += stat.chiamate_totali || 0
    group.chiamate_completate += stat.chiamate_completate || 0
    group.molto_soddisfatti += stat.molto_soddisfatti || 0
    group.soddisfatti += stat.soddisfatti || 0
    group.poco_soddisfatti += stat.poco_soddisfatti || 0
    group.insoddisfatti += stat.insoddisfatti || 0
    group.non_vuole_contatto += stat.non_vuole_contatto || 0
    group.numeri_sbagliati += stat.numeri_sbagliati || 0
    group.cellulari_staccati += stat.cellulari_staccati || 0
    group.non_risponde += stat.non_risponde || 0
    group.da_richiamare += stat.da_richiamare || 0
  })

  // Convert to array and add calculated fields
  return Array.from(grouped.values()).map(stat => ({
    ...stat,
    tasso_completamento: stat.chiamate_totali > 0
      ? Math.round((stat.chiamate_completate / stat.chiamate_totali) * 100)
      : 0,
    tasso_soddisfazione: stat.chiamate_completate > 0
      ? Math.round(((stat.molto_soddisfatti + stat.soddisfatti) / stat.chiamate_completate) * 100)
      : 0
  }))
}

// Helper function to format period display
function formatPeriod(periodo: string, timeView: string): string {
  if (!periodo) return ''

  const date = new Date(periodo)

  switch (timeView) {
    case 'week':
      const weekEnd = new Date(date)
      weekEnd.setDate(date.getDate() + 6)
      return `${date.toLocaleDateString('it-IT')} - ${weekEnd.toLocaleDateString('it-IT')}`
    case 'month':
      return date.toLocaleDateString('it-IT', { year: 'numeric', month: 'long' })
    case 'quarter':
      const quarter = Math.floor(date.getMonth() / 3) + 1
      return `Q${quarter} ${date.getFullYear()}`
    case 'semester':
      const semester = date.getMonth() <= 5 ? 1 : 2
      return `${semester}° Semestre ${date.getFullYear()}`
    case 'year':
      return date.getFullYear().toString()
    default: // day
      return date.toLocaleDateString('it-IT')
  }
}

// Helper function to calculate summary
function calculateSummary(data: any[]) {
  const totali = data.reduce((acc, stat) => ({
    totale_chiamate: acc.totale_chiamate + (stat.chiamate_totali || 0),
    totale_completate: acc.totale_completate + (stat.chiamate_completate || 0),
    totale_molto_soddisfatti: acc.totale_molto_soddisfatti + (stat.molto_soddisfatti || 0),
    totale_soddisfatti: acc.totale_soddisfatti + (stat.soddisfatti || 0),
    totale_poco_soddisfatti: acc.totale_poco_soddisfatti + (stat.poco_soddisfatti || 0),
    totale_insoddisfatti: acc.totale_insoddisfatti + (stat.insoddisfatti || 0),
    totale_problemi_tecnici: acc.totale_problemi_tecnici + (stat.numeri_sbagliati || 0) + (stat.cellulari_staccati || 0),
    totale_da_richiamare: acc.totale_da_richiamare + (stat.da_richiamare || 0)
  }), {
    totale_chiamate: 0,
    totale_completate: 0,
    totale_molto_soddisfatti: 0,
    totale_soddisfatti: 0,
    totale_poco_soddisfatti: 0,
    totale_insoddisfatti: 0,
    totale_problemi_tecnici: 0,
    totale_da_richiamare: 0
  })

  return {
    totale_chiamate: totali.totale_chiamate,
    tasso_completamento: totali.totale_chiamate > 0
      ? Math.round((totali.totale_completate / totali.totale_chiamate) * 100)
      : 0,
    tasso_soddisfazione: totali.totale_completate > 0
      ? Math.round(((totali.totale_molto_soddisfatti + totali.totale_soddisfatti) / totali.totale_completate) * 100)
      : 0,
    media_molto_soddisfatti: totali.totale_completate > 0
      ? Math.round((totali.totale_molto_soddisfatti / totali.totale_completate) * 100)
      : 0,
    problemi_tecnici: totali.totale_problemi_tecnici,
    da_richiamare_totali: totali.totale_da_richiamare
  }
}
