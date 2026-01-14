export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/procedures/quiz/manager-review
 * Allows managers to reset quiz status after training session
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) {
      return NextResponse.json(
        { error: 'Non autorizzato' },
        { status: 401 }
      )
    }

    // Check if user is admin/manager
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'manager')) {
      return NextResponse.json(
        { error: 'Accesso negato: solo manager e admin possono eseguire questa operazione' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { procedure_id, user_id, notes } = body

    if (!procedure_id || !user_id) {
      return NextResponse.json(
        { error: 'procedure_id e user_id sono obbligatori' },
        { status: 400 }
      )
    }

    // Create admin client for service role operations
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Call the database function to reset manager review
    const { data: result, error: resetError } = await adminClient
      .rpc('reset_manager_review', {
        p_procedure_id: procedure_id,
        p_user_id: user_id,
        p_manager_id: user.id,
        p_notes: notes || null
      })

    if (resetError) {
      console.error('Error resetting manager review:', resetError)
      return NextResponse.json(
        { error: 'Errore nel reset della revisione' },
        { status: 500 }
      )
    }

    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result, { status: 200 })

  } catch (error) {
    console.error('Error in POST /api/procedures/quiz/manager-review:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}
