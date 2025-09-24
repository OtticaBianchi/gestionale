export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Database } from '@/types/database.types'

// POST - Genera report errori per diversi timeframe
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    // Profile check (tutti i ruoli possono generare il report)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profilo non trovato' }, { status: 404 })
    }

    // Get timeframe from query parameters
    const timeframe = searchParams.get('timeframe') || 'week'

    // Calculate date range based on timeframe
    const getDateRange = (tf: string) => {
      const now = Date.now()
      switch (tf) {
        case 'week':
          return { days: 7, label: 'Settimanale', period: 'ultima settimana' }
        case 'month':
          return { days: 30, label: 'Mensile', period: 'ultimo mese' }
        case '3month':
          return { days: 90, label: 'Trimestrale', period: 'ultimi 3 mesi' }
        case '6month':
          return { days: 180, label: 'Semestrale', period: 'ultimi 6 mesi' }
        case 'year':
          return { days: 365, label: 'Annuale', period: 'ultimo anno' }
        default:
          return { days: 7, label: 'Settimanale', period: 'ultima settimana' }
      }
    }

    const timeConfig = getDateRange(timeframe)
    const startDate = new Date(Date.now() - timeConfig.days * 24 * 60 * 60 * 1000).toISOString()

    // Use service role per query dati
    const adminClient = (await import('@supabase/supabase-js')).createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Query per errori del periodo selezionato
    const { data: periodErrors, error } = await adminClient
      .from('error_tracking')
      .select(`
        id,
        error_type,
        error_category,
        error_description,
        cost_amount,
        cost_type,
        client_impacted,
        requires_reorder,
        time_lost_minutes,
        reported_at,
        resolution_status,
        employee:profiles!error_tracking_employee_id_fkey(
          full_name,
          role
        ),
        busta:buste(
          readable_id
        ),
        cliente:clienti(
          nome,
          cognome
        )
      `)
      .gte('reported_at', startDate)
      .order('reported_at', { ascending: false })

    if (error) {
      console.error(`Error fetching ${timeframe} errors:`, error)
      return NextResponse.json({ error: 'Errore caricamento dati' }, { status: 500 })
    }

    // Statistiche aggregate
    const stats = {
      total_errors: periodErrors?.length || 0,
      total_cost: periodErrors?.reduce((sum, err) => sum + (err.cost_amount || 0), 0) || 0,
      critical_errors: periodErrors?.filter(err => err.error_category === 'critico').length || 0,
      medium_errors: periodErrors?.filter(err => err.error_category === 'medio').length || 0,
      low_errors: periodErrors?.filter(err => err.error_category === 'basso').length || 0,
      client_impacted: periodErrors?.filter(err => err.client_impacted).length || 0,
      unresolved: periodErrors?.filter(err => err.resolution_status === 'open').length || 0,
      avg_cost: periodErrors?.length > 0 ? (periodErrors.reduce((sum, err) => sum + (err.cost_amount || 0), 0) / periodErrors.length) : 0
    }

    // Raggruppamento per dipendente
    const errorsByEmployee = (periodErrors || []).reduce((acc: any, error: any) => {
      const employeeName = error.employee?.full_name || 'N/A'
      if (!acc[employeeName]) {
        acc[employeeName] = {
          count: 0,
          cost: 0,
          critical: 0,
          errors: []
        }
      }
      acc[employeeName].count++
      acc[employeeName].cost += error.cost_amount
      if (error.error_category === 'critico') acc[employeeName].critical++
      acc[employeeName].errors.push(error)
      return acc
    }, {})

    // Raggruppamento per tipo errore
    const errorsByType = (periodErrors || []).reduce((acc: any, error) => {
      if (!acc[error.error_type]) {
        acc[error.error_type] = {
          count: 0,
          cost: 0,
          critical: 0
        }
      }
      acc[error.error_type].count++
      acc[error.error_type].cost += error.cost_amount
      if (error.error_category === 'critico') acc[error.error_type].critical++
      return acc
    }, {})

    // Analisi trend (per report mensili e oltre)
    let trendAnalysis = null
    if (timeConfig.days >= 30) {
      // Dividi il periodo in settimane per vedere il trend
      const weeks = []
      const weekCount = Math.min(Math.floor(timeConfig.days / 7), 8) // Max 8 settimane per leggibilità

      for (let i = 0; i < weekCount; i++) {
        const weekStart = new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000)
        const weekEnd = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000)

        const weekErrors = (periodErrors || []).filter(error => {
          const errorDate = new Date(error.reported_at)
          return errorDate >= weekStart && errorDate < weekEnd
        })

        weeks.push({
          week: `Settimana ${weekCount - i}`,
          errors: weekErrors.length,
          cost: weekErrors.reduce((sum, err) => sum + err.cost_amount, 0),
          critical: weekErrors.filter(err => err.error_category === 'critico').length
        })
      }

      trendAnalysis = weeks.reverse()
    }

    // Genera report HTML
    const reportDate = new Date().toLocaleDateString('it-IT')
    const startDateFormatted = new Date(startDate).toLocaleDateString('it-IT')

    const getTypeDisplay = (type: string) => {
      const types: Record<string, string> = {
        'anagrafica_cliente': 'Anagrafica Cliente',
        'materiali_ordine': 'Ordini Materiali',
        'comunicazione_cliente': 'Comunicazione Cliente',
        'misurazioni_vista': 'Controllo Vista/Misurazioni',
        'controllo_qualita': 'Controllo Qualità',
        'consegna_prodotto': 'Consegna Prodotto',
        'gestione_pagamenti': 'Gestione Pagamenti',
        'voice_note_processing': 'Note Vocali',
        'busta_creation': 'Gestione Buste',
        'altro': 'Altro'
      }
      return types[type] || type
    }

    const getCategoryColor = (category: string) => {
      switch (category) {
        case 'critico': return '#dc2626'
        case 'medio': return '#d97706'
        case 'basso': return '#059669'
        default: return '#6b7280'
      }
    }

    const htmlReport = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report Errori ${timeConfig.label} - ${reportDate}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; line-height: 1.6; color: #333; background: #f9fafb; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { background: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
    .header h1 { color: #1f2937; margin-bottom: 10px; }
    .header p { color: #6b7280; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
    .stat-value { font-size: 2.2rem; font-weight: bold; margin-bottom: 5px; }
    .stat-label { color: #6b7280; font-size: 0.9rem; }
    .section { background: white; padding: 25px; border-radius: 8px; margin-bottom: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .section h2 { color: #1f2937; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb; }
    .table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    .table th, .table td { text-align: left; padding: 12px; border-bottom: 1px solid #e5e7eb; }
    .table th { background: #f9fafb; font-weight: 600; color: #374151; }
    .table tr:hover { background: #f9fafb; }
    .error-list { margin-top: 20px; }
    .error-item { background: #f9fafb; margin: 10px 0; padding: 15px; border-radius: 6px; border-left: 4px solid #d1d5db; }
    .error-meta { display: flex; gap: 15px; margin-bottom: 8px; font-size: 0.9rem; color: #6b7280; }
    .error-description { color: #374151; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: 500; color: white; }
    .no-errors { text-align: center; color: #6b7280; padding: 40px; }
    .trend-chart { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 15px; margin-top: 20px; }
    .trend-week { background: #f3f4f6; padding: 15px; border-radius: 6px; text-align: center; }
    .trend-week h4 { color: #374151; margin-bottom: 8px; font-size: 0.9rem; }
    .trend-week .trend-value { font-size: 1.5rem; font-weight: bold; color: #dc2626; }
    .trend-week .trend-detail { font-size: 0.8rem; color: #6b7280; margin-top: 4px; }
    .footer { text-align: center; color: #6b7280; font-size: 0.9rem; margin-top: 30px; }
    .highlight-box { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .highlight-box h3 { color: #92400e; margin-bottom: 10px; }
    .highlight-box p { color: #a16207; }
    @media print { body { background: white; } .container { max-width: none; padding: 0; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Report Errori ${timeConfig.label}</h1>
      <p>Periodo: ${startDateFormatted} - ${reportDate}</p>
      <p>Generato da: ${profile.full_name} (${profile.role})</p>
      <p style="margin-top: 10px; font-style: italic; color: #059669;">
        ${stats.total_errors === 0 ? '🎉 Periodo eccellente senza errori registrati!' : `Analisi completa di ${stats.total_errors} errori`}
      </p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value" style="color: #1f2937;">${stats.total_errors}</div>
        <div class="stat-label">Errori Totali</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #dc2626;">€${stats.total_cost.toFixed(2)}</div>
        <div class="stat-label">Costo Totale</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #dc2626;">${stats.critical_errors}</div>
        <div class="stat-label">Errori Critici</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #d97706;">${stats.medium_errors}</div>
        <div class="stat-label">Errori Medi</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #059669;">${stats.low_errors}</div>
        <div class="stat-label">Errori Bassi</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #dc2626;">${stats.unresolved}</div>
        <div class="stat-label">Non Risolti</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: #059669;">€${stats.avg_cost.toFixed(2)}</div>
        <div class="stat-label">Costo Medio</div>
      </div>
    </div>

    ${stats.total_cost > 500 ? `
    <div class="highlight-box">
      <h3>⚠️ Attenzione: Costi Elevati</h3>
      <p>Il costo totale degli errori per questo periodo (€${stats.total_cost.toFixed(2)}) supera la soglia di attenzione di €500. È consigliabile analizzare le cause principali e implementare misure correttive.</p>
    </div>
    ` : ''}

    ${trendAnalysis ? `
    <div class="section">
      <h2>📈 Trend ${timeConfig.label.toLowerCase()}</h2>
      <div class="trend-chart">
        ${trendAnalysis.map((week: any) => `
          <div class="trend-week">
            <h4>${week.week}</h4>
            <div class="trend-value">${week.errors}</div>
            <div class="trend-detail">€${week.cost.toFixed(0)} • ${week.critical} critici</div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <div class="section">
      <h2>📊 Performance per Dipendente</h2>
      ${Object.keys(errorsByEmployee).length > 0 ? `
        <table class="table">
          <thead>
            <tr>
              <th>Dipendente</th>
              <th>Errori</th>
              <th>Costo</th>
              <th>Critici</th>
              <th>Costo Medio</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(errorsByEmployee)
              .sort(([,a]: [string, any], [,b]: [string, any]) => b.cost - a.cost)
              .map(([name, data]: [string, any]) => `
                <tr>
                  <td><strong>${name}</strong></td>
                  <td>${data.count}</td>
                  <td>€${data.cost.toFixed(2)}</td>
                  <td>${data.critical}</td>
                  <td>€${(data.cost / data.count).toFixed(2)}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      ` : '<div class="no-errors">🎉 Nessun errore registrato per questo periodo!</div>'}
    </div>

    <div class="section">
      <h2>📈 Analisi per Tipo Errore</h2>
      ${Object.keys(errorsByType).length > 0 ? `
        <table class="table">
          <thead>
            <tr>
              <th>Tipo Errore</th>
              <th>Occorrenze</th>
              <th>Costo</th>
              <th>Critici</th>
              <th>% del Totale</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(errorsByType)
              .sort(([,a]: [string, any], [,b]: [string, any]) => b.count - a.count)
              .map(([type, data]: [string, any]) => `
                <tr>
                  <td><strong>${getTypeDisplay(type)}</strong></td>
                  <td>${data.count}</td>
                  <td>€${data.cost.toFixed(2)}</td>
                  <td>${data.critical}</td>
                  <td>${((data.count / stats.total_errors) * 100).toFixed(1)}%</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      ` : '<div class="no-errors">🎉 Nessun errore per tipo!</div>'}
    </div>

    <div class="section">
      <h2>📝 Lista Dettagliata Errori</h2>
      <div class="error-list">
        ${periodErrors && periodErrors.length > 0 ?
          periodErrors.slice(0, 50).map((error: any) => `
            <div class="error-item" style="border-left-color: ${getCategoryColor(error.error_category)};">
              <div class="error-meta">
                <span><strong>📅</strong> ${new Date(error.reported_at).toLocaleDateString('it-IT')}</span>
                <span><strong>👤</strong> ${error.employee?.full_name || 'N/A'}</span>
                <span><strong>💰</strong> €${error.cost_amount.toFixed(2)}</span>
                <span class="badge" style="background-color: ${getCategoryColor(error.error_category)};">${error.error_category.toUpperCase()}</span>
                ${error.busta ? `<span><strong>📁</strong> ${error.busta.readable_id}</span>` : ''}
                ${error.cliente ? `<span><strong>👥</strong> ${error.cliente.cognome} ${error.cliente.nome}</span>` : ''}
              </div>
              <div class="error-description">
                <strong>${getTypeDisplay(error.error_type)}:</strong> ${error.error_description}
                ${error.client_impacted ? ' <span style="color: #dc2626;">⚠️ Cliente impattato</span>' : ''}
                ${error.requires_reorder ? ' <span style="color: #d97706;">🔄 Riordino necessario</span>' : ''}
              </div>
            </div>
          `).join('')
        : '<div class="no-errors">🎉 Nessun errore registrato per questo periodo! Eccellente lavoro del team!</div>'}
        ${periodErrors && periodErrors.length > 50 ? `
          <div style="text-align: center; padding: 20px; color: #6b7280;">
            <p>Mostrati i primi 50 errori di ${periodErrors.length} totali</p>
          </div>
        ` : ''}
      </div>
    </div>

    <div class="footer">
      <p>🤖 Report generato automaticamente dal sistema di tracciamento errori</p>
      <p>Gestionale Ottico - ${reportDate}</p>
      <p style="margin-top: 10px; font-size: 0.8rem;">
        Questo report copre ${timeConfig.period} e include analisi dettagliate per il miglioramento continuo della qualità del servizio
      </p>
    </div>
  </div>
</body>
</html>
    `

    return new NextResponse(htmlReport, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="report-errori-${timeConfig.label.toLowerCase()}-${new Date().toISOString().split('T')[0]}.html"`
      }
    })

  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json({ error: 'Errore generazione report' }, { status: 500 })
  }
}