export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/procedures/quiz/analytics
 * Get comprehensive quiz analytics for governance dashboard
 * Admin/Manager only
 */
export async function GET(request: NextRequest) {
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
        { error: 'Accesso negato: solo manager e admin possono accedere alle analitiche' },
        { status: 403 }
      )
    }

    // Get query parameters for date filtering
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Create admin client for service role operations
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch quiz procedures (used to build analytics per procedure)
    const { data: quizProcedures, error: quizProceduresError } = await adminClient
      .from('procedure_quiz_questions')
      .select('procedure_id, procedure:procedures(id, title, slug, is_active)')

    if (quizProceduresError) {
      throw quizProceduresError
    }

    // Fetch quiz attempts with optional date filters
    let attemptsQuery = adminClient
      .from('procedure_quiz_attempts')
      .select('procedure_id, passed, attempt_number, submitted_at')

    if (startDate) {
      attemptsQuery = attemptsQuery.gte('submitted_at', startDate)
    }

    if (endDate) {
      attemptsQuery = attemptsQuery.lte('submitted_at', endDate)
    }

    const { data: attemptsData, error: attemptsError } = await attemptsQuery

    if (attemptsError) {
      throw attemptsError
    }

    const procedureMap = new Map<string, {
      procedure_id: string
      procedure_title: string
      procedure_slug: string
      total_attempts: number
      total_passed: number
      total_failed: number
      pass_rate: number
      avg_attempts_to_pass: number
      _passes_count: number
      _passes_sum: number
    }>()

    quizProcedures?.forEach((row) => {
      const procedureValue = (row as { procedure?: any }).procedure
      const procedure = Array.isArray(procedureValue) ? procedureValue[0] : procedureValue
      const procedureData = procedure as { id: string; title: string; slug: string; is_active: boolean } | null | undefined
      if (!procedureData || procedureData.is_active === false) return
      if (procedureMap.has(row.procedure_id)) return

      procedureMap.set(row.procedure_id, {
        procedure_id: row.procedure_id,
        procedure_title: procedureData.title,
        procedure_slug: procedureData.slug,
        total_attempts: 0,
        total_passed: 0,
        total_failed: 0,
        pass_rate: 0,
        avg_attempts_to_pass: 0,
        _passes_count: 0,
        _passes_sum: 0
      })
    })

    attemptsData?.forEach((attempt) => {
      const entry = procedureMap.get(attempt.procedure_id)
        ?? {
          procedure_id: attempt.procedure_id,
          procedure_title: 'Procedura',
          procedure_slug: attempt.procedure_id,
          total_attempts: 0,
          total_passed: 0,
          total_failed: 0,
          pass_rate: 0,
          avg_attempts_to_pass: 0,
          _passes_count: 0,
          _passes_sum: 0
        }

      entry.total_attempts += 1
      if (attempt.passed) {
        entry.total_passed += 1
        entry._passes_count += 1
        entry._passes_sum += attempt.attempt_number || 0
      } else {
        entry.total_failed += 1
      }

      procedureMap.set(attempt.procedure_id, entry)
    })

    const analytics = Array.from(procedureMap.values()).map((entry) => {
      const passRate = entry.total_attempts > 0
        ? (entry.total_passed / entry.total_attempts) * 100
        : 0

      const avgAttemptsToPass = entry._passes_count > 0
        ? Number((entry._passes_sum / entry._passes_count).toFixed(2))
        : 0

      return {
        procedure_id: entry.procedure_id,
        procedure_title: entry.procedure_title,
        procedure_slug: entry.procedure_slug,
        total_attempts: entry.total_attempts,
        total_passed: entry.total_passed,
        total_failed: entry.total_failed,
        pass_rate: Number(passRate.toFixed(2)),
        avg_attempts_to_pass: avgAttemptsToPass
      }
    })

    // Get users requiring manager review
    const { data: reviewNeeded, error: reviewError } = await adminClient
      .from('procedure_quiz_status')
      .select(`
        id,
        procedure_id,
        user_id,
        total_attempts,
        consecutive_failures,
        manager_review_requested_at,
        procedure:procedures(id, title, slug),
        user:profiles!procedure_quiz_status_user_id_fkey(id, full_name)
      `)
      .eq('requires_manager_review', true)
      .order('manager_review_requested_at', { ascending: true })

    if (reviewError) {
      console.error('Error fetching review requests:', reviewError)
      // Continue without review data
    }

    let totalAttempts = 0
    let totalPassed = 0
    let totalFailed = 0

    if (attemptsData) {
      totalAttempts = attemptsData.length
      totalPassed = attemptsData.filter(a => a.passed).length
      totalFailed = attemptsData.filter(a => !a.passed).length
    }

    // Get total users who have taken quizzes
    const { data: uniqueUsers } = await adminClient
      .from('procedure_quiz_status')
      .select('user_id')

    const totalUsers = uniqueUsers
      ? [...new Set(uniqueUsers.map(u => u.user_id))].length
      : 0

    // Get pending reviews count
    const { count: pendingReviews } = await adminClient
      .from('procedure_quiz_status')
      .select('*', { count: 'exact', head: true })
      .eq('requires_manager_review', true)

    return NextResponse.json({
      overall_stats: {
        total_attempts: totalAttempts,
        total_passed: totalPassed,
        total_failed: totalFailed,
        pass_rate: totalAttempts > 0 ? ((totalPassed / totalAttempts) * 100).toFixed(2) : 0,
        total_users: totalUsers,
        pending_reviews: pendingReviews || 0
      },
      procedure_analytics: analytics,
      users_requiring_review: reviewNeeded || [],
      filters: {
        start_date: startDate,
        end_date: endDate
      }
    })

  } catch (error) {
    console.error('Error in GET /api/procedures/quiz/analytics:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}
