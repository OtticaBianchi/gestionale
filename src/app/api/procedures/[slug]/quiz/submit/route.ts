export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/procedures/[slug]/quiz/submit
 * Submit quiz answers and get graded results
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
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

    const { slug } = await params
    const body = await request.json()
    const { answers, time_spent_seconds } = body

    // Validate request body
    if (!answers || typeof answers !== 'object') {
      return NextResponse.json(
        { error: 'Risposte non valide' },
        { status: 400 }
      )
    }

    // Create admin client for service role operations
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get procedure ID from slug
    const { data: procedure, error: procedureError } = await adminClient
      .from('procedures')
      .select('id')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (procedureError || !procedure) {
      return NextResponse.json(
        { error: 'Procedura non trovata' },
        { status: 404 }
      )
    }

    // Call the database function to process the quiz attempt
    const { data: result, error: processError } = await adminClient
      .rpc('process_quiz_attempt', {
        p_procedure_id: procedure.id,
        p_user_id: user.id,
        p_answers: answers,
        p_time_spent_seconds: time_spent_seconds || null
      })

    if (processError) {
      console.error('Error processing quiz attempt:', processError)
      return NextResponse.json(
        { error: 'Errore nella valutazione del quiz' },
        { status: 500 }
      )
    }

    // Check if the result indicates an error (cooldown, already passed, etc.)
    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }

    // Success response
    return NextResponse.json(result, { status: 200 })

  } catch (error) {
    console.error('Error in POST /api/procedures/[slug]/quiz/submit:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}
