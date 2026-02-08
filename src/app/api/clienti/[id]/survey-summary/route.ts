export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const extractSuggestionFromRawPayload = (rawPayload: any): string | null => {
  if (!rawPayload || typeof rawPayload !== 'object') return null
  const entries = Object.entries(rawPayload)
  for (const [key, value] of entries) {
    if (!/suggeriment/i.test(key)) continue
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed) return trimmed
  }
  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const serverClient = await createServerSupabaseClient()
    const { data: { user } } = await serverClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { id: clienteId } = await params
    if (!clienteId) {
      return NextResponse.json({ error: 'Cliente non valido' }, { status: 400 })
    }

    const admin = createClient<any>(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data, error } = await admin
      .from('survey_client_summary')
      .select('*')
      .eq('cliente_id', clienteId)
      .maybeSingle()

    if (error) {
      console.error('GET /api/clienti/[id]/survey-summary query error:', error)
      return NextResponse.json({ error: 'Errore recupero survey cliente' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ success: true, data: null })
    }

    const { data: matchRows, error: matchesError } = await admin
      .from('survey_response_matches')
      .select('survey_response_id')
      .eq('cliente_id', clienteId)
      .eq('needs_review', false)

    if (matchesError) {
      console.error('GET /api/clienti/[id]/survey-summary matches error:', matchesError)
      return NextResponse.json({ error: 'Errore recupero storico survey cliente' }, { status: 500 })
    }

    const responseIds = Array.from(new Set((matchRows || []).map((row: any) => row.survey_response_id).filter(Boolean)))
    let latestSuggestion: string | null = null
    let responseHistory: Array<{ id: string; overall_score: number | null; submitted_at: string | null; created_at: string | null }> = []

    if (responseIds.length > 0) {
      const { data: responses, error: responsesError } = await admin
        .from('survey_responses')
        .select('id, overall_score, submitted_at, created_at, raw_payload')
        .in('id', responseIds)
        .order('submitted_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (responsesError) {
        console.error('GET /api/clienti/[id]/survey-summary responses error:', responsesError)
        return NextResponse.json({ error: 'Errore recupero risposte survey cliente' }, { status: 500 })
      }

      const rows = responses || []
      responseHistory = rows.map((row: any) => ({
        id: row.id,
        overall_score: typeof row.overall_score === 'number' ? row.overall_score : null,
        submitted_at: row.submitted_at || null,
        created_at: row.created_at || null
      }))
      latestSuggestion = rows.length > 0 ? extractSuggestionFromRawPayload(rows[0].raw_payload) : null
    }

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        latest_suggestion: latestSuggestion,
        response_history: responseHistory
      }
    })
  } catch (error: any) {
    console.error('GET /api/clienti/[id]/survey-summary error:', error)
    return NextResponse.json({ error: error?.message || 'Errore interno server' }, { status: 500 })
  }
}
