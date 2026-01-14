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

    // Get quiz analytics using the database function
    const { data: analytics, error: analyticsError } = await adminClient
      .rpc('get_quiz_analytics', {
        p_start_date: startDate || null,
        p_end_date: endDate || null
      })

    if (analyticsError) {
      console.error('Error fetching quiz analytics:', analyticsError)
      return NextResponse.json(
        { error: 'Errore nel caricamento delle analitiche' },
        { status: 500 }
      )
    }

    // Get users requiring manager review
    const { data: reviewNeeded, error: reviewError } = await adminClient
      .from('procedure_quiz_status')
      .select(`
        *,
        procedure:procedures(id, title, slug),
        user:profiles(id, nome, cognome, email)
      `)
      .eq('requires_manager_review', true)
      .order('manager_review_requested_at', { ascending: true })

    if (reviewError) {
      console.error('Error fetching review requests:', reviewError)
      // Continue without review data
    }

    // Get overall statistics
    const { data: overallStats, error: statsError } = await adminClient
      .from('procedure_quiz_attempts')
      .select('id, passed, submitted_at')

    let totalAttempts = 0
    let totalPassed = 0
    let totalFailed = 0

    if (!statsError && overallStats) {
      totalAttempts = overallStats.length
      totalPassed = overallStats.filter(a => a.passed).length
      totalFailed = overallStats.filter(a => !a.passed).length
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
      procedure_analytics: analytics || [],
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
