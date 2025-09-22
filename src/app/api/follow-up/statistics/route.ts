import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// GET - Recupera statistiche follow-up
export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const operatorId = searchParams.get('operator_id')

    // Verifica autenticazione
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Query base per le statistiche
    let query = supabase
      .from('statistiche_follow_up')
      .select(`
        *,
        profiles (
          full_name
        )
      `)
      .order('data_riferimento', { ascending: false })

    // Filtri opzionali
    if (startDate) {
      query = query.gte('data_riferimento', startDate)
    }
    if (endDate) {
      query = query.lte('data_riferimento', endDate)
    }
    if (operatorId) {
      query = query.eq('operatore_id', operatorId)
    }

    const { data: statistiche, error } = await query

    if (error) {
      console.error('Errore recupero statistiche:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Processa i dati per il frontend
    const processedStats = statistiche?.map(stat => ({
      ...stat,
      operatore_nome: stat.profiles?.full_name,
      tasso_completamento: stat.chiamate_totali > 0
        ? Math.round((stat.chiamate_completate / stat.chiamate_totali) * 100)
        : 0,
      tasso_soddisfazione: (stat.molto_soddisfatti + stat.soddisfatti) > 0
        ? Math.round(((stat.molto_soddisfatti + stat.soddisfatti) / stat.chiamate_completate) * 100)
        : 0
    })) || []

    // Calcola statistiche aggregate
    const totali = processedStats.reduce((acc, stat) => ({
      totale_chiamate: acc.totale_chiamate + stat.chiamate_totali,
      totale_completate: acc.totale_completate + stat.chiamate_completate,
      totale_molto_soddisfatti: acc.totale_molto_soddisfatti + stat.molto_soddisfatti,
      totale_soddisfatti: acc.totale_soddisfatti + stat.soddisfatti,
      totale_poco_soddisfatti: acc.totale_poco_soddisfatti + stat.poco_soddisfatti,
      totale_insoddisfatti: acc.totale_insoddisfatti + stat.insoddisfatti,
      totale_problemi_tecnici: acc.totale_problemi_tecnici + stat.numeri_sbagliati + stat.cellulari_staccati,
      totale_da_richiamare: acc.totale_da_richiamare + stat.da_richiamare
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

    const summary = {
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

    return NextResponse.json({
      success: true,
      data: processedStats,
      summary
    })

  } catch (error) {
    console.error('Errore GET statistiche:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}
