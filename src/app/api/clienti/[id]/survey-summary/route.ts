export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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

    return NextResponse.json({ success: true, data: data || null })
  } catch (error: any) {
    console.error('GET /api/clienti/[id]/survey-summary error:', error)
    return NextResponse.json({ error: error?.message || 'Errore interno server' }, { status: 500 })
  }
}
