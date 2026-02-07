export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    const serverClient = await createServerSupabaseClient()
    const { data: { user } } = await serverClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { data: profile } = await serverClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Solo admin' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get('limit') || 50), 200)
    const offset = Math.max(Number(searchParams.get('offset') || 0), 0)
    const onlyNeedsReview = searchParams.get('needs_review') !== 'false'

    const admin = createClient<any>(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    let query = admin
      .from('survey_match_review_queue')
      .select('*', { count: 'exact' })
      .order('response_created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (onlyNeedsReview) {
      query = query.eq('needs_review', true)
    }

    const { data, error, count } = await query
    if (error) {
      console.error('GET /api/admin/survey-matches error:', error)
      return NextResponse.json({ error: 'Errore recupero coda matching survey' }, { status: 500 })
    }

    const rows = data || []
    const candidateIds = new Set<string>()
    for (const row of rows) {
      const ids = Array.isArray(row.candidate_client_ids) ? row.candidate_client_ids : []
      for (const candidateId of ids) {
        if (typeof candidateId === 'string' && candidateId.trim() !== '') {
          candidateIds.add(candidateId)
        }
      }
    }

    let candidateMap: Record<string, { id: string; nome: string | null; cognome: string | null; email: string | null }> = {}
    if (candidateIds.size > 0) {
      const { data: candidateClients, error: clientsError } = await admin
        .from('clienti')
        .select('id, nome, cognome, email, deleted_at')
        .in('id', [...candidateIds])

      if (clientsError) {
        console.error('GET /api/admin/survey-matches candidate clients error:', clientsError)
      } else {
        candidateMap = (candidateClients || [])
          .filter((client: any) => !client.deleted_at)
          .reduce((acc: any, client: any) => {
          acc[client.id] = client
          return acc
          }, {})
      }
    }

    const enrichedRows = rows.map((row) => {
      const ids = Array.isArray(row.candidate_client_ids) ? row.candidate_client_ids : []
      return {
        ...row,
        candidate_clients: ids
          .map((candidateId: string) => candidateMap[candidateId])
          .filter(Boolean)
      }
    })

    return NextResponse.json({
      success: true,
      data: enrichedRows,
      pagination: {
        limit,
        offset,
        total: count || 0
      }
    })
  } catch (error: any) {
    console.error('GET /api/admin/survey-matches fatal error:', error)
    return NextResponse.json({ error: error?.message || 'Errore interno server' }, { status: 500 })
  }
}
