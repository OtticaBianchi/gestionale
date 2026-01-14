export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/procedures/[slug]/quiz/status
 * Get quiz status and attempt history for the current user
 */
export async function GET(
  _request: NextRequest,
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

    // Create admin client for service role operations
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get procedure ID from slug
    const { data: procedure, error: procedureError } = await adminClient
      .from('procedures')
      .select('id, title, slug')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (procedureError || !procedure) {
      return NextResponse.json(
        { error: 'Procedura non trovata' },
        { status: 404 }
      )
    }

    // Get quiz status
    const { data: status, error: statusError } = await adminClient
      .from('procedure_quiz_status')
      .select('*')
      .eq('user_id', user.id)
      .eq('procedure_id', procedure.id)
      .maybeSingle()

    if (statusError) {
      console.error('Error fetching quiz status:', statusError)
      return NextResponse.json(
        { error: 'Errore nel caricamento dello stato del quiz' },
        { status: 500 }
      )
    }

    // Get recent attempts
    const { data: attempts, error: attemptsError } = await adminClient
      .from('procedure_quiz_attempts')
      .select('id, attempt_number, submitted_at, questions_total, questions_correct, passed, time_spent_seconds')
      .eq('user_id', user.id)
      .eq('procedure_id', procedure.id)
      .order('submitted_at', { ascending: false })
      .limit(5)

    if (attemptsError) {
      console.error('Error fetching quiz attempts:', attemptsError)
      // Continue without attempts if there's an error
    }

    // Calculate cooldown remaining if applicable
    let cooldown_remaining_seconds = 0
    let can_attempt = true

    if (status && !status.is_passed && !status.requires_manager_review && status.last_attempt_at) {
      const lastAttemptTime = new Date(status.last_attempt_at).getTime()
      const now = Date.now()
      const oneHourInMs = 3600 * 1000
      const timeSinceLastAttempt = now - lastAttemptTime

      if (timeSinceLastAttempt < oneHourInMs) {
        cooldown_remaining_seconds = Math.ceil((oneHourInMs - timeSinceLastAttempt) / 1000)
        can_attempt = false
      }
    }

    // If already passed, can't attempt again
    if (status?.is_passed) {
      can_attempt = false
    }

    // If manager review required, can't attempt
    if (status?.requires_manager_review) {
      can_attempt = false
    }

    return NextResponse.json({
      procedure: {
        id: procedure.id,
        title: procedure.title,
        slug: procedure.slug
      },
      status: status || {
        is_passed: false,
        total_attempts: 0,
        consecutive_failures: 0,
        requires_manager_review: false,
        last_attempt_at: null,
        last_passed_at: null
      },
      can_attempt,
      cooldown_remaining_seconds,
      recent_attempts: attempts || []
    })

  } catch (error) {
    console.error('Error in GET /api/procedures/[slug]/quiz/status:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}
