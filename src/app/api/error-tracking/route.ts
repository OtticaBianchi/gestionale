export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logInsert, logUpdate } from '@/lib/audit/auditLog'
import { Database } from '@/types/database.types'
import {
  calculateAssegnazioneColpa,
  validateErrorClassification,
  type StepWorkflow,
  type IntercettatoDa,
  type ProceduraFlag,
  type ImpattoCliente,
  type AssegnazioneColpa,
} from '@/lib/et2/assegnazioneColpa'
import { shouldGenerateProcedureSuggestion } from '@/lib/et2/procedureSuggestions'

type ErrorTrackingRow = {
  id: string
  busta_id: string | null
  employee_id: string
  cliente_id: string | null
  error_type: string
  error_category: 'critico' | 'medio' | 'basso'
  error_description: string
  cost_type: 'real' | 'estimate'
  cost_amount: number
  cost_detail: string | null
  client_impacted: boolean
  requires_reorder: boolean
  time_lost_minutes: number
  reported_by: string
  reported_at: string
  resolution_status: 'open' | 'in_progress' | 'resolved' | 'cannot_resolve'
  resolution_notes: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  is_draft: boolean
  auto_created_from_order: string | null
  // ET2.0 fields
  step_workflow: StepWorkflow | null
  intercettato_da: IntercettatoDa | null
  procedura_flag: ProceduraFlag | null
  impatto_cliente: ImpattoCliente | null
  assegnazione_colpa: AssegnazioneColpa | null
  operatore_coinvolto: string | null
  creato_da_followup: boolean
}

const pickAuditSnapshot = (row: Partial<ErrorTrackingRow>) => ({
  busta_id: row.busta_id ?? null,
  employee_id: row.employee_id ?? null,
  cliente_id: row.cliente_id ?? null,
  error_type: row.error_type ?? null,
  error_category: row.error_category ?? null,
  cost_type: row.cost_type ?? null,
  cost_amount: row.cost_amount ?? null,
  resolution_status: row.resolution_status ?? null,
  resolution_notes: row.resolution_notes ?? null,
  resolved_by: row.resolved_by ?? null,
  resolved_at: row.resolved_at ?? null,
  is_draft: row.is_draft ?? null,
  client_impacted: row.client_impacted ?? null,
  requires_reorder: row.requires_reorder ?? null,
  auto_created_from_order: row.auto_created_from_order ?? null,
  // ET2.0 fields
  step_workflow: row.step_workflow ?? null,
  intercettato_da: row.intercettato_da ?? null,
  procedura_flag: row.procedura_flag ?? null,
  impatto_cliente: row.impatto_cliente ?? null,
  assegnazione_colpa: row.assegnazione_colpa ?? null,
  operatore_coinvolto: row.operatore_coinvolto ?? null,
  creato_da_followup: row.creato_da_followup ?? null,
})

// GET - Lista errori con filtri e statistiche
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = new URL(request.url)

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    // Profile and role check
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profilo non trovato' }, { status: 404 })
    }

    // Parametri filtri
    const timeframe = searchParams.get('timeframe') || 'month'
    const employee_id = searchParams.get('employee_id')
    const error_type = searchParams.get('error_type')
    const error_category = searchParams.get('error_category')
    const resolution_status = searchParams.get('resolution_status')
    const busta_id = searchParams.get('busta_id')

    // Calcolo range date
    const getDateRange = (timeframe: string) => {
      const now = new Date()
      switch (timeframe) {
        case 'week':
          return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        case 'month':
          return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
        case 'quarter':
          return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
        case 'year':
          return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()
        default:
          return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    }

    // Use service role for complex query after auth check (like ordini API)
    const adminClient = (await import('@supabase/supabase-js')).createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Query base con JOIN per dati correlati (stile API esistente)
    let query = adminClient
      .from('error_tracking')
      .select(`
        id,
        busta_id,
        employee_id,
        cliente_id,
        error_type,
        error_category,
        error_description,
        cost_type,
        cost_amount,
        cost_detail,
        client_impacted,
        requires_reorder,
        time_lost_minutes,
        reported_by,
        reported_at,
        resolution_status,
        resolution_notes,
        resolved_by,
        resolved_at,
        created_at,
        updated_at,
        is_draft,
        auto_created_from_order,
        step_workflow,
        intercettato_da,
        procedura_flag,
        impatto_cliente,
        assegnazione_colpa,
        operatore_coinvolto,
        creato_da_followup,
        employee:profiles!error_tracking_employee_id_fkey(
          id,
          full_name,
          role
        ),
        reported_by_profile:profiles!error_tracking_reported_by_fkey(
          id,
          full_name
        ),
        operatore:profiles!error_tracking_operatore_coinvolto_fkey(
          id,
          full_name
        ),
        busta:buste(
          id,
          readable_id,
          stato_attuale
        ),
        cliente:clienti(
          id,
          nome,
          cognome
        )
      `)
      .gte('reported_at', getDateRange(timeframe))
      .order('reported_at', { ascending: false })

    // Applica filtri se presenti
    if (employee_id) query = query.eq('employee_id', employee_id)
    if (error_type) query = query.eq('error_type', error_type)
    if (error_category) query = query.eq('error_category', error_category)
    if (resolution_status) query = query.eq('resolution_status', resolution_status)
    if (busta_id) query = query.eq('busta_id', busta_id)

    // Esegui query
    const { data: errors, error } = await query

    if (error) {
      console.error('Error fetching error tracking data:', error)
      return NextResponse.json({ error: 'Errore caricamento dati errori' }, { status: 500 })
    }

    // Statistiche aggregate per dashboard (come nel pattern esistente)
    const stats = {
      total_errors: errors?.length || 0,
      total_cost: errors?.reduce((sum, err) => sum + (err.cost_amount || 0), 0) || 0,
      critical_errors: errors?.filter(err => err.error_category === 'critico').length || 0,
      client_impacted: errors?.filter(err => err.client_impacted).length || 0,
      unresolved: errors?.filter(err => err.resolution_status === 'open').length || 0,
      avg_cost: errors?.length > 0 ? (errors.reduce((sum, err) => sum + (err.cost_amount || 0), 0) / errors.length) : 0
    }

    return NextResponse.json({
      success: true,
      data: errors || [],
      stats,
      timeframe,
      filters: {
        employee_id,
        error_type,
        error_category,
        resolution_status,
        busta_id
      }
    })

  } catch (error) {
    console.error('Error in GET /api/error-tracking:', error)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}

// POST - Registra nuovo errore
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    // Role check - solo manager/admin possono inserire errori
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Permessi insufficienti - solo manager/admin' }, { status: 403 })
    }

    const body = await request.json()
    const {
      busta_id,
      employee_id,
      cliente_id,
      error_type,
      error_category,
      error_description,
      cost_type = 'estimate',
      custom_cost,
      cost_detail,
      time_lost_minutes = 0,
      client_impacted = false,
      requires_reorder = false,
      is_draft = false,
      auto_created_from_order = null,
      // ET2.0 fields
      step_workflow,
      intercettato_da,
      procedura_flag,
      impatto_cliente,
      operatore_coinvolto,
      creato_da_followup = false,
      procedure_id, // For procedure suggestion linking
    } = body

    // Validazione input obbligatori
    if (!employee_id || !error_type || !error_category || !error_description) {
      return NextResponse.json({
        error: 'Campi obbligatori mancanti: employee_id, error_type, error_category, error_description'
      }, { status: 400 })
    }

    // ET2.0: Validate classification fields
    if (step_workflow || procedura_flag) {
      const validation = validateErrorClassification({
        step_workflow,
        intercettato_da,
        procedura_flag,
        impatto_cliente,
        operatore_coinvolto,
        creato_da_followup,
      })

      if (!validation.valid) {
        return NextResponse.json({
          error: 'Validazione ET2.0 fallita',
          details: validation.errors
        }, { status: 400 })
      }
    }

    // Calcola costo automatico se non fornito (come nel pattern esistente)
    let cost_amount = custom_cost

    if (!custom_cost) {
      // Use service role per query costi default
      const adminClient = (await import('@supabase/supabase-js')).createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data: costDefault } = await adminClient
        .from('error_cost_defaults')
        .select('default_cost')
        .eq('error_type', error_type)
        .eq('error_category', error_category)
        .eq('is_active', true)
        .single()

      if (costDefault) {
        cost_amount = costDefault.default_cost
      } else {
        // Fallback costs
        const fallback_costs = {
          critico: 250,
          medio: 100,
          basso: 25
        }
        cost_amount = fallback_costs[error_category as keyof typeof fallback_costs] || 50
      }
    }

    // ET2.0: Calculate automatic fault assignment
    let assegnazione_colpa: AssegnazioneColpa | null = null
    if (step_workflow && procedura_flag) {
      assegnazione_colpa = calculateAssegnazioneColpa({
        step_workflow,
        intercettato_da,
        procedura_flag,
        impatto_cliente,
        operatore_coinvolto,
        creato_da_followup,
      })
    }

    // Use service role per inserimento (after auth check)
    const adminClient = (await import('@supabase/supabase-js')).createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Inserisci l'errore
    const { data: newError, error: insertError } = await adminClient
      .from('error_tracking')
      .insert({
        busta_id: busta_id || null,
        employee_id,
        cliente_id: cliente_id || null,
        error_type,
        error_category,
        error_description,
        cost_type,
        cost_amount,
        cost_detail,
        time_lost_minutes,
        client_impacted,
        requires_reorder,
        reported_by: user.id,
        is_draft,
        auto_created_from_order,
        // ET2.0 fields
        step_workflow: step_workflow || null,
        intercettato_da: intercettato_da || null,
        procedura_flag: procedura_flag || null,
        impatto_cliente: impatto_cliente || null,
        assegnazione_colpa,
        operatore_coinvolto: operatore_coinvolto || null,
        creato_da_followup,
      })
      .select(`
        id,
        busta_id,
        employee_id,
        cliente_id,
        cost_amount,
        cost_type,
        error_type,
        error_category,
        error_description,
        client_impacted,
        requires_reorder,
        is_draft,
        auto_created_from_order,
        reported_at,
        step_workflow,
        intercettato_da,
        procedura_flag,
        impatto_cliente,
        assegnazione_colpa,
        operatore_coinvolto,
        creato_da_followup,
        employee:profiles!error_tracking_employee_id_fkey(full_name)
      `)
      .single()

    if (insertError) {
      console.error('Error inserting error record:', insertError)
      return NextResponse.json({ error: 'Errore inserimento errore' }, { status: 500 })
    }

    const auditInsert = await logInsert(
      'error_tracking',
      newError.id,
      user.id,
      pickAuditSnapshot(newError as Partial<ErrorTrackingRow>),
      `Registrazione errore (${error_type})`,
      {
        source: 'api/error-tracking',
        isDraft: is_draft,
        autoCreated: Boolean(auto_created_from_order)
      },
      profile.role
    )

    if (!auditInsert.success) {
      console.error('AUDIT_INSERT_ERROR_TRACKING_FAILED', auditInsert.error)
    }

    // ET2.0: Auto-generate procedure suggestion if needed
    let procedureSuggestionCreated = false
    if (step_workflow && procedura_flag && !is_draft) {
      const suggestionEval = shouldGenerateProcedureSuggestion({
        errore_id: newError.id,
        procedure_id,
        step_workflow,
        procedura_flag,
        error_description,
        error_type,
      })

      if (suggestionEval.should_create && suggestionEval.suggestion_data) {
        try {
          const { error: suggestionError } = await adminClient
            .from('procedure_suggestions')
            .insert({
              ...suggestionEval.suggestion_data,
              suggested_by: user.id,
            })

          if (suggestionError) {
            console.error('Failed to auto-create procedure suggestion:', suggestionError)
          } else {
            procedureSuggestionCreated = true
            console.log(`✅ Auto-generated procedure suggestion for error ${newError.id}`)
          }
        } catch (err) {
          console.error('Error creating procedure suggestion:', err)
        }
      }
    }

    // Log per errori critici (come nel pattern esistente)
    if (error_category === 'critico') {
      console.log(`🚨 ERRORE CRITICO registrato: ${newError.id} - €${cost_amount} - ${(newError.employee as any)?.full_name}`)
    }

    return NextResponse.json({
      success: true,
      data: newError,
      message: 'Errore registrato con successo',
      meta: {
        procedure_suggestion_created: procedureSuggestionCreated,
        assegnazione_colpa,
      }
    })

  } catch (error) {
    console.error('Error in POST /api/error-tracking:', error)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}

// PATCH - Aggiorna risoluzione errore (solo admin)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    // Role check - solo admin può modificare
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Solo admin possono modificare errori' }, { status: 403 })
    }

    const body = await request.json()
    const { id, resolution_status, resolution_notes } = body

    if (!id) {
      return NextResponse.json({ error: 'ID errore richiesto' }, { status: 400 })
    }

    // Use service role per update
    const adminClient = (await import('@supabase/supabase-js')).createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: existing, error: existingError } = await adminClient
      .from('error_tracking')
      .select('id, resolution_status, resolution_notes, resolved_by, resolved_at')
      .eq('id', id)
      .single()

    if (existingError || !existing) {
      console.error('Error fetching existing error record:', existingError)
      return NextResponse.json({ error: 'Errore non trovato' }, { status: 404 })
    }

    const updateData: any = {}
    if (resolution_status) {
      updateData.resolution_status = resolution_status
      if (resolution_status === 'resolved') {
        updateData.resolved_by = user.id
        updateData.resolved_at = new Date().toISOString()
      }
    }
    if (resolution_notes !== undefined) updateData.resolution_notes = resolution_notes

    const { data, error } = await adminClient
      .from('error_tracking')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating error record:', error)
      return NextResponse.json({ error: 'Errore aggiornamento errore' }, { status: 500 })
    }

    const auditUpdate = await logUpdate(
      'error_tracking',
      id,
      user.id,
      pickAuditSnapshot(existing as Partial<ErrorTrackingRow>),
      pickAuditSnapshot(data as Partial<ErrorTrackingRow>),
      'Aggiornamento risoluzione errore',
      {
        source: 'api/error-tracking',
        newStatus: resolution_status ?? null
      },
      profile.role
    )

    if (!auditUpdate.success) {
      console.error('AUDIT_UPDATE_ERROR_TRACKING_FAILED', auditUpdate.error)
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Errore aggiornato con successo'
    })

  } catch (error) {
    console.error('Error in PATCH /api/error-tracking:', error)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}
