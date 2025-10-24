export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getUnreadProceduresCount } from '@/lib/procedures/unread'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const adminClient = (await import('@supabase/supabase-js')).createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const count = await getUnreadProceduresCount(adminClient, user.id)

    return NextResponse.json({
      success: true,
      count
    })
  } catch (error) {
    console.error('Error in GET /api/procedures/unread-count:', error)
    return NextResponse.json({ error: 'Errore interno server' }, { status: 500 })
  }
}
