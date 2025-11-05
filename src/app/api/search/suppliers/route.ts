// API Route: Get all suppliers for search dropdown
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    // Fetch all supplier tables in parallel
    const [lentiRes, lacRes, montaturaRes, labRes, sportRes] = await Promise.all([
      supabase.from('fornitori_lenti').select('id, nome').order('nome'),
      supabase.from('fornitori_lac').select('id, nome').order('nome'),
      supabase.from('fornitori_montature').select('id, nome').order('nome'),
      supabase.from('fornitori_lab_esterno').select('id, nome').order('nome'),
      supabase.from('fornitori_sport').select('id, nome').order('nome'),
    ])

    // Combine all suppliers with their category
    const suppliers = [
      ...(lentiRes.data || []).map(s => ({ ...s, category: 'lenti', categoryLabel: 'Lenti' })),
      ...(lacRes.data || []).map(s => ({ ...s, category: 'lac', categoryLabel: 'LAC' })),
      ...(montaturaRes.data || []).map(s => ({ ...s, category: 'montature', categoryLabel: 'Montature' })),
      ...(labRes.data || []).map(s => ({ ...s, category: 'lab_esterno', categoryLabel: 'Laboratorio' })),
      ...(sportRes.data || []).map(s => ({ ...s, category: 'sport', categoryLabel: 'Sport' })),
    ]

    return NextResponse.json({ suppliers })
  } catch (error: any) {
    console.error('❌ Error fetching suppliers:', error)
    return NextResponse.json({ error: 'Errore nel caricamento fornitori' }, { status: 500 })
  }
}
